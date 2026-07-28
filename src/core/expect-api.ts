import { createArchiveExpectation } from '../assertions/archive/archive-expectation.js';
import { createCommandExpectation } from '../assertions/command-expectation.js';
import { createFileExpectation } from '../assertions/file/file-expectation.js';
import { createFileSetExpectation } from '../assertions/file/file-set-expectation.js';
import { createDirectorySnapshotExpectation } from '../assertions/snapshot/directory-snapshot.js';
import { createTextSnapshotExpectation } from '../assertions/snapshot/text-snapshot.js';
import type { SmokeExpectApi } from '../assertions/types.js';
import { createValueExpectation } from '../assertions/value-expectation.js';

export function createExpectApi(): SmokeExpectApi {
    const callable = (<T>(value: T) => createValueExpectation(value)) as SmokeExpectApi;

    callable.value = (value) => createValueExpectation(value);
    callable.command = (result) => createCommandExpectation(result);
    callable.file = (path) => {
        return createFileExpectation(path);
    };
    callable.files = (root) => {
        return createFileSetExpectation(root);
    };
    callable.archive = (path) => createArchiveExpectation(path);
    callable.text = (value) => createTextSnapshotExpectation(value);
    callable.directory = (root) => createDirectorySnapshotExpectation(root);

    return callable;
}
