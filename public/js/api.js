// fetch-запросы к серверу. Ошибка несёт status и code из ответа.
async function request(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
}

export const getApartments = () => request('/api/apartments');

export const getApartment = (id) => request(`/api/apartments/${encodeURIComponent(id)}`);

export const postLead = (lead) =>
  request('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead),
  });
