const axios = require('axios');
(async () => {
    try {
        const response = await axios.get('https://winongkencono-samela.hf.space/api/books/25/pages?limit=5&offset=0');
        console.log(JSON.stringify(response.data, null, 2));
    } catch(e) {
        console.error(e.message);
    }
})();
