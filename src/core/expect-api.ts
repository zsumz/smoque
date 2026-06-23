import {
    createArchiveExpectation,
    createCommandExpectation,
    createDirectorySnapshotExpectation,
    createFileExpectation,
    createFileSetExpectation,
    createTextSnapshotExpectation,
    createValueExpectation,
} from '../assertions/index.js';
import type { SmokeExpectApi } from '../assertions/types.js';

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
