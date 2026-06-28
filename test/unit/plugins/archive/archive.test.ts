import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { beforeEach, test } from "vitest";

import { resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../../dist/core.js";
import archivePlugin from "../../../../dist/plugins/archive.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("t.archive.list lists tar and tgz entries", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-archive-tar-"));

  try {
    const tarPath = join(root, "fixture.tar");
    const tgzPath = join(root, "fixture.tgz");
    const tar = createTar([
      ["package/index.js", "export const ok = true;\n"],
      ["package/lib/util.js", "export const util = true;\n"],
    ]);

    await writeFile(tarPath, tar);
    await writeFile(tgzPath, gzipSync(tar));

    smoke.use(archivePlugin());
    smoke.suite("tar listing", async (t) => {
      assert.deepEqual(await t.archive.list(tarPath), ["package/index.js", "package/lib/util.js"]);
      assert.deepEqual(await t.archive.list(tgzPath), ["package/index.js", "package/lib/util.js"]);
    });

    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("t.archive.list lists zip and jar entries", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-archive-zip-"));

  try {
    await mkdir(root, { recursive: true });
    const zipPath = join(root, "fixture.zip");
    const jarPath = join(root, "fixture.jar");
    const zip = createZip([
      ["dist/index.js", "export const ok = true;\n"],
      ["META-INF/MANIFEST.MF", "Manifest-Version: 1.0\n"],
    ]);

    await writeFile(zipPath, zip);
    await writeFile(jarPath, zip);

    smoke.use(archivePlugin());
    smoke.suite("zip listing", async (t) => {
      assert.deepEqual(await t.archive.list(zipPath), ["META-INF/MANIFEST.MF", "dist/index.js"]);
      assert.deepEqual(await t.archive.list(jarPath), ["META-INF/MANIFEST.MF", "dist/index.js"]);
    });

    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function createTar(entries) {
  const chunks = [];

  for (const [name, content] of entries) {
    const body = Buffer.from(content, "utf8");
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, "utf8");
    header.write("0000644\0", 100, 8, "ascii");
    header.write("0000000\0", 108, 8, "ascii");
    header.write("0000000\0", 116, 8, "ascii");
    header.write(body.byteLength.toString(8).padStart(11, "0") + "\0", 124, 12, "ascii");
    header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, "0") + "\0", 136, 12, "ascii");
    header.fill(0x20, 148, 156);
    header.write("0", 156, 1, "ascii");
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");

    const checksum = [...header].reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");

    chunks.push(header, body, Buffer.alloc((512 - (body.byteLength % 512)) % 512));
  }

  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

function createZip(entries) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const [name, content] of entries) {
    const nameBuffer = Buffer.from(name, "utf8");
    const body = Buffer.from(content, "utf8");
    const crc = crc32(body);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.byteLength, 18);
    local.writeUInt32LE(body.byteLength, 22);
    local.writeUInt16LE(nameBuffer.byteLength, 26);
    local.writeUInt16LE(0, 28);
    localChunks.push(local, nameBuffer, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.byteLength, 20);
    central.writeUInt32LE(body.byteLength, 24);
    central.writeUInt16LE(nameBuffer.byteLength, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt32LE(offset, 42);
    centralChunks.push(central, nameBuffer);

    offset += local.byteLength + nameBuffer.byteLength + body.byteLength;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.byteLength, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...localChunks, centralDirectory, end]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
