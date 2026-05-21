const { execSync } = require('child_process');
try {
    const status = execSync('git status', { encoding: 'utf-8', cwd: __dirname });
    console.log('STATUS:\n', status);
    const remote = execSync('git remote -v', { encoding: 'utf-8', cwd: __dirname });
    console.log('REMOTE:\n', remote);
} catch (e) {
    console.error('ERROR:', e.message, e.stderr);
}
