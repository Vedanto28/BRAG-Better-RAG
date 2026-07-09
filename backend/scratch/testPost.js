async function test(msg) {
  try {
    const res = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    console.log(`[Query] "${msg}"`);
    console.log(`[Status] ${res.status}`);
    console.log(`[Data]`, JSON.stringify(data, null, 2));
    console.log('---------------------------------------------');
  } catch (err) {
    console.error(`Error querying "${msg}":`, err);
  }
}

async function run() {
  await test("who is the president of usa");
  await test("What is BRAG?");
  await test("What is 12 multiplied by 8?");
}

run();
