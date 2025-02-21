class CryptoAPI {
    constructor() {
        this.baseUrl = 'https://api.coingecko.com/api/v3';
        this.headers = {
            'x-cg-demo-api-key': 'CG-C3ySD8tMAG8ECj3aauK2jpAY'
        };
    }

    async searchCoins(query) {
        try {
            const response = await fetch(`${this.baseUrl}/search?query=${query}`, {
                headers: this.headers
            });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            return data.coins.slice(0, 10);
        } catch (error) {
            console.error('Error searching coins:', error);
            return [];
        }
    }

    async getCoinPrice(coinId) {
        try {
            const response = await fetch(
                `${this.baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd`, {
                    headers: this.headers
                }
            );
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            return data[coinId];
        } catch (error) {
            console.error('Error fetching coin price:', error);
            return null;
        }
    }
}