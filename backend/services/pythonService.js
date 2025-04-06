const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const callPythonService = async (filePath) => {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    const response = await axios.post('http://localhost:5001/summarize', formData, {
      headers: formData.getHeaders()
    });

    return response.data.summary;
  } catch (error) {
    console.error('Error calling Python service:', error);
    throw error;
  }
};

module.exports = { callPythonService };