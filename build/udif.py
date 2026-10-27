"""Pakker et rått diskbilde (her: ISO/HFS+-hybrid) inn i en komprimert Apple UDIF .dmg (UDZO).

Formatet: komprimerte datablokker, en XML-plist med blkx-tabell (mish) og en 512-byte koly-trailer.
"""
import plistlib
import struct
import sys
import uuid
import zlib

SECTOR = 512
CHUNK_SECTORS = 2048  # 1 MiB per blokk, som hdiutil

T_ZLIB = 0x80000005
T_RAW = 0x00000001
T_IGNORE = 0x00000002
T_TERM = 0xFFFFFFFF
CRC32_TYPE = 2


def checksum_struct(crc):
    return struct.pack(">II", CRC32_TYPE, 32) + struct.pack(">I", crc) + b"\0" * 124


def build(src, dst, name="Filutforsker"):
    raw = open(src, "rb").read()
    if len(raw) % SECTOR:
        raw += b"\0" * (SECTOR - len(raw) % SECTOR)
    total_sectors = len(raw) // SECTOR

    chunks = []
    data = bytearray()
    for s in range(0, total_sectors, CHUNK_SECTORS):
        n = min(CHUNK_SECTORS, total_sectors - s)
        block = raw[s * SECTOR:(s + n) * SECTOR]
        if block.count(0) == len(block):
            chunks.append((T_IGNORE, s, n, len(data), 0))
            continue
        comp = zlib.compress(block, 9)
        if len(comp) < len(block):
            chunks.append((T_ZLIB, s, n, len(data), len(comp)))
            data += comp
        else:
            chunks.append((T_RAW, s, n, len(data), len(block)))
            data += block
    chunks.append((T_TERM, total_sectors, 0, len(data), 0))

    part_crc = zlib.crc32(raw) & 0xFFFFFFFF
    mish = b"mish" + struct.pack(">IQQQII", 1, 0, total_sectors, 0, CHUNK_SECTORS + 8, 0)
    mish += b"\0" * 24
    mish += checksum_struct(part_crc)
    mish += struct.pack(">I", len(chunks))
    for typ, s, n, off, ln in chunks:
        mish += struct.pack(">IIQQQQ", typ, 0, s, n, off, ln)

    plist = {
        "resource-fork": {
            "blkx": [{
                "Attributes": "0x0050",
                "CFName": "whole disk (Apple_partition_scheme : 0)",
                "Data": mish,
                "ID": "0",
                "Name": "whole disk (Apple_partition_scheme : 0)",
            }],
        }
    }
    xml = plistlib.dumps(plist, fmt=plistlib.FMT_XML)

    data_crc = zlib.crc32(bytes(data)) & 0xFFFFFFFF
    master_crc = zlib.crc32(struct.pack(">I", part_crc)) & 0xFFFFFFFF

    xml_off = len(data)
    koly = b"koly" + struct.pack(">III", 4, 512, 1)
    koly += struct.pack(">QQQQQ", 0, 0, len(data), 0, 0)
    koly += struct.pack(">II", 1, 1)
    koly += uuid.uuid4().bytes
    koly += checksum_struct(data_crc)
    koly += struct.pack(">QQ", xml_off, len(xml))
    koly += b"\0" * 120
    koly += checksum_struct(master_crc)
    koly += struct.pack(">IQ", 1, total_sectors)
    koly += b"\0" * 12
    assert len(koly) == 512, len(koly)

    with open(dst, "wb") as f:
        f.write(data)
        f.write(xml)
        f.write(koly)
    return total_sectors, len(data)


def verify(dmg, original):
    """Les .dmg tilbake uavhengig av skrivekoden og sammenlign med originalen."""
    buf = open(dmg, "rb").read()
    k = buf[-512:]
    assert k[:4] == b"koly"
    ver, hsize, flags = struct.unpack(">III", k[4:16])
    _, dfo, dfl, _, _ = struct.unpack(">QQQQQ", k[16:56])
    data_crc = struct.unpack(">I", k[0x50 + 8:0x50 + 12])[0]
    xml_off, xml_len = struct.unpack(">QQ", k[0xD8:0xE8])
    sectors = struct.unpack(">Q", k[0x1EC:0x1F4])[0]
    assert zlib.crc32(buf[dfo:dfo + dfl]) & 0xFFFFFFFF == data_crc, "datasjekksum stemmer ikke"
    pl = plistlib.loads(buf[xml_off:xml_off + xml_len])
    out = bytearray()
    for b in pl["resource-fork"]["blkx"]:
        m = b["Data"]
        assert m[:4] == b"mish"
        n = struct.unpack(">I", m[200:204])[0]
        for i in range(n):
            typ, _, s, c, off, ln = struct.unpack(">IIQQQQ", m[204 + 40 * i:244 + 40 * i])
            if typ == T_TERM:
                break
            if typ == T_ZLIB:
                blk = zlib.decompress(buf[dfo + off:dfo + off + ln])
            elif typ == T_RAW:
                blk = buf[dfo + off:dfo + off + ln]
            else:
                blk = b"\0" * (c * SECTOR)
            assert len(blk) == c * SECTOR
            out += blk
    orig = open(original, "rb").read()
    orig += b"\0" * (-len(orig) % SECTOR)
    assert len(out) == sectors * SECTOR
    assert bytes(out) == orig, "innholdet stemmer ikke"
    return True


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    secs, n = build(src, dst)
    print(f"{secs} sektorer, {n} byte komprimert")
    print("verifisert:", verify(dst, src))
