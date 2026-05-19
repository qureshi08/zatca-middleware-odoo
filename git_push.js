const { execSync } = require('child_process');
try {
    console.log("Staging...");
    execSync('git -C "d:\\Anas\\ZATCA-Universal-Portal-[18-05-2026]" add -A', { stdio: 'inherit' });
    console.log("Committing...");
    execSync('git -C "d:\\Anas\\ZATCA-Universal-Portal-[18-05-2026]" commit -m "chore: secure setup API endpoint"', { stdio: 'inherit' });
    console.log("Pushing...");
    execSync('git -C "d:\\Anas\\ZATCA-Universal-Portal-[18-05-2026]" push origin main', { stdio: 'inherit' });
    console.log("All done!");
} catch (e) {
    console.error(e.message);
}
