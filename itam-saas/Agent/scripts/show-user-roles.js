import * as auth from '../authQueries.js';

async function main() {
  try {
    const users = await auth.getAllAuthUsers();
    console.log('🧑‍💻 Users and roles:');
    for (const u of users) {
      console.log(`- id=${u.id} username=${u.username} role=${u.role} active=${u.is_active}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to list users:', err.message || err);
    process.exit(1);
  }
}

main();
