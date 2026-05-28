/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const gulp = require('gulp');
const es = require('event-stream');
const path = require('path');
const cp = require('child_process');
const task = require('./lib/task');
const { hygiene } = require('./hygiene');

const checkBuiltinToolsCoverageTask = task.define('check-builtin-tools-coverage', (done) => {
	const scriptPath = path.join(__dirname, 'scripts', 'check-builtin-tools-coverage.js');
	const result = cp.spawnSync(process.execPath, [scriptPath], { stdio: 'inherit' });
	if (result.status !== 0) {
		done(new Error('builtin-tools coverage check failed'));
		return;
	}
	done();
});
gulp.task(checkBuiltinToolsCoverageTask);

/**
 * @param {string} actualPath
 */
function checkPackageJSON(actualPath) {
	const actual = require(path.join(__dirname, '..', actualPath));
	const rootPackageJSON = require('../package.json');
	const checkIncluded = (set1, set2) => {
		for (const depName in set1) {
			const depVersion = set1[depName];
			const rootDepVersion = set2[depName];
			if (!rootDepVersion) {
				// missing in root is allowed
				continue;
			}
			if (depVersion !== rootDepVersion) {
				this.emit(
					'error',
					`The dependency ${depName} in '${actualPath}' (${depVersion}) is different than in the root package.json (${rootDepVersion})`
				);
			}
		}
	};

	checkIncluded(actual.dependencies, rootPackageJSON.dependencies);
	checkIncluded(actual.devDependencies, rootPackageJSON.devDependencies);
}

const checkPackageJSONTask = task.define('check-package-json', () => {
	return gulp.src('package.json').pipe(
		es.through(function () {
			checkPackageJSON.call(this, 'remote/package.json');
			checkPackageJSON.call(this, 'remote/web/package.json');
			checkPackageJSON.call(this, 'build/package.json');
		})
	);
});
gulp.task(checkPackageJSONTask);

const hygieneTask = task.define('hygiene', task.series(checkPackageJSONTask, checkBuiltinToolsCoverageTask, () => hygiene(undefined, false)));
gulp.task(hygieneTask);
