class PriceDisplay {
    constructor(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container element with id '${containerId}' not found`);
        }
        this.container = container;

        // Create a wrapper for the token name and button
        this.tokenWrapper = document.createElement('div');
        this.tokenWrapper.className = 'token-wrapper'; // Add a class for styling

        // Create elements for token name and price
        this.tokenNameElement = document.createElement('div');
        this.tokenNameElement.className = 'token-name';

        // Create a button for the CoinGecko link
        this.coinGeckoLinkButton = document.createElement('button');
        this.coinGeckoLinkButton.className = 'coin-gecko-link';
        this.coinGeckoLinkButton.textContent = 'View on CoinGecko';
        this.coinGeckoLinkButton.style.display = 'none'; // Initially hidden

        this.priceElement = document.createElement('div');
        this.priceElement.className = 'token-price';

        // Append elements to the wrapper
        this.tokenWrapper.appendChild(this.tokenNameElement);
        this.tokenWrapper.appendChild(this.coinGeckoLinkButton);
        
        // Append the wrapper to the container
        this.container.appendChild(this.tokenWrapper);
        this.container.appendChild(this.priceElement);

        // Add click event to the button
        this.coinGeckoLinkButton.addEventListener('click', () => {
            window.open(this.coinGeckoUrl, '_blank'); // Open in a new tab
        });
    }

    async fetchPriceData(coinId) {
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
        
        try {
            const response = await fetch(apiUrl);
            
            // Check if the response is OK
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Attempt to parse the response as JSON
            const data = await response.json();
            
            // Check if the expected data is present
            if (!data[coinId]) {
                throw new Error(`Data for ${coinId} not found in response.`);
            }

            return data[coinId].usd; // Return the current price in USD
        } catch (error) {
            console.error('Error fetching price data:', error);
            throw error; // Rethrow the error for further handling
        }
    }

    async loadPrice(coinId, coinName) {
        // Set the token name
        this.tokenNameElement.textContent = `Token: ${coinName}`;
        
        // Set the CoinGecko URL
        this.coinGeckoUrl = `https://www.coingecko.com/en/coins/${coinId}`;
        this.coinGeckoLinkButton.style.display = 'inline'; // Show the button

        // Fetch and display the current price
        const currentPrice = await this.fetchPriceData(coinId);
        this.priceElement.textContent = `Current Price: $${currentPrice.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 10
        })}`; // Display the current price

        // Clear any previous intervals to avoid multiple updates
        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
        }

        // Set interval to update the price every 30 seconds
        this.priceUpdateInterval = setInterval(async () => {
            const updatedPrice = await this.fetchPriceData(coinId);
            this.priceElement.textContent = `Current Price: $${updatedPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 10
            })}`; // Update the current price
        }, 30000); // Update every 30 seconds
    }
}

async function loadTokenPrice(coinId, coinName) {
    console.log(`Loading price for token: ${coinId}`); // Debug log
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        const price = data[coinId].usd; // Get the price in USD
        console.log(`Price for ${coinId}: $${price}`); // Debug log

        // Update the UI with the token price and ticker
        document.getElementById('tokenTicker').textContent = `Ticker: ${coinName.toUpperCase()}`; // Update ticker
        document.getElementById('tokenPrice').textContent = `Price: $${price.toFixed(2)}`; // Update price

        // Optionally, load chart data for the selected token
        await loadChartData(coinId); // Load historical data for the selected token
    } catch (error) {
        console.error('Error fetching token price:', error);
        // Optionally, update the UI to show an error message
        document.getElementById('tokenTicker').textContent = 'Ticker: N/A';
        document.getElementById('tokenPrice').textContent = 'Price: N/A';
    }
}

async function loadChartData(coinId) {
    console.log(`Loading chart data for token: ${coinId}`); // Debug log
    try {
        // Fetch historical data (e.g., last 30 days)
        const historicalResponse = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30`);
        if (!historicalResponse.ok) {
            throw new Error('Network response was not ok');
        }
        const historicalData = await historicalResponse.json();
        
        // Extract prices and timestamps
        const prices = historicalData.prices.map(price => ({
            x: new Date(price[0]), // Timestamp
            y: price[1] // Price
        }));

        // Update the chart with the new data
        updateChart(prices); // Call a function to update the chart
    } catch (error) {
        console.error('Error fetching chart data:', error);
    }
}
