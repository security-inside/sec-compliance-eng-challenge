const api = 'http://localhost:8000';
const form = document.querySelector('#query-form');
const status = document.querySelector('#status');
const results = document.querySelector('#results');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  results.replaceChildren();
  status.textContent = 'Loading…';
  const token = document.querySelector('#token').value;
  const server = document.querySelector('#server').value;

  try {
    const response = await fetch(`${api}/v1/servers/${encodeURIComponent(server)}/snapshots`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const snapshots = await response.json();
    status.textContent = `${snapshots.length} snapshot(s)`;

    for (const snapshot of snapshots) {
      const item = document.createElement('li');
      const text = document.createElement('p');
      text.textContent = `${snapshot.collected_at} · execution ${snapshot.execution_id} · SHA-256 ${snapshot.sha256}`;
      item.append(text);

      if (snapshot.csv_available) {
        const button = document.createElement('button');
        button.textContent = 'Download CSV';
        button.addEventListener('click', async () => {
          const download = await fetch(`${api}/v1/servers/${encodeURIComponent(server)}/snapshots/${encodeURIComponent(snapshot.execution_id)}/csv`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!download.ok) {
            status.textContent = `Download failed (${download.status})`;
            return;
          }
          const anchor = document.createElement('a');
          anchor.href = URL.createObjectURL(await download.blob());
          anchor.download = `${snapshot.execution_id}.csv`;
          anchor.click();
          URL.revokeObjectURL(anchor.href);
        });
        item.append(button);
      }
      results.append(item);
    }
  } catch (error) {
    status.textContent = error.message;
  }
});

