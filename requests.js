const axios = require('axios');

const endpoint = "https://your-api.com/endpoint";

const posts = [
  "value1=ab&value2=12",
  "value1=cd&value2=34",
  "value1=ef&value2=56",
];

async function sendPostRequests() {
  const promises = posts.map(param =>
    axios.post(`${endpoint}?${param}`)
  );

  const responses = await Promise.all(promises);
  responses.forEach(res => console.log(res.status, res.data));
}

async function sendGetRequest() {
  try {
    const response = await axios.get('${endpoint}?ID=12345');
    console.log(response);
  } catch (error) {
    console.error(error);
  }
}

async function sendPatchRequests() {
  const promises = requests.map(param =>
    axios.post(`https://your-api.com/endpoint?${param}`)
  );

  const responses = await Promise.all(promises);
  responses.forEach(res => console.log(res.status, res.data));
}

sendGetRequest();
sendPostRequests();
sendGetRequest();
sendPatchRequests();
sendGetRequest();
