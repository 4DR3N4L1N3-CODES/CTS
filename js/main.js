// Initialize variables
const api = new CryptoAPI();
const priceDisplay = new PriceDisplay('priceContainer');
const trading = new TradingSimulator();

let currentCoin = 'bitcoin';
let currentPrice = 0;
let searchTimeout = null;
let currentCoinName = '';

// Wait for DOM to be fully loaded before adding event listeners
document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    // Initialize with saved data
    const savedData = trading.loadFromLocalStorage();
    if (savedData && savedData.portfolio) {
        const firstCoin = Object.keys(savedData.portfolio)[0];
        if (firstCoin) {
            currentCoin = firstCoin;
            // Get the coin name from CoinGecko
            try {
                const searchResult = await api.searchCoins(firstCoin);
                if (searchResult.length > 0) {
                    currentCoinName = searchResult[0].name;
                } else {
                    currentCoinName = firstCoin;
                }
            } catch (error) {
                console.error('Error getting coin name:', error);
                currentCoinName = firstCoin;
            }
        }
    }

    priceDisplay.loadPrice(currentCoin, currentCoinName);

    async function updatePrice() {
        try {
            const priceData = await api.getCoinPrice(currentCoin);
            if (priceData) {
                currentPrice = priceData.usd;
                // Display current price and token name on the page
                const priceDisplay = document.createElement('div');
                priceDisplay.id = 'currentPrice';
                priceDisplay.innerHTML = `
                    <span class="selected-token">${currentCoinName || currentCoin}</span>
                    <span class="price-value">Current Price: $${currentPrice.toFixed(2)}</span>
                `;
                
                // Update or add price display
                const existingPrice = document.getElementById('currentPrice');
                if (existingPrice) {
                    existingPrice.replaceWith(priceDisplay);
                } else {
                    document.querySelector('.trading-panel').insertBefore(priceDisplay, document.querySelector('.trading-controls'));
                }
                
                return currentPrice;
            }
            return null;
        } catch (error) {
            console.error('Error updating price:', error);
            return null;
        }
    }

    // Search input event handler
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        if (!query) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            const results = await api.searchCoins(query);
            
            searchResults.innerHTML = '';
            
            if (results.length > 0) {
                results.forEach(coin => {
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.innerHTML = `
                        <img src="${coin.thumb}" alt="${coin.name}" />
                        <span>${coin.name} (${coin.symbol.toUpperCase()})</span>
                    `;
                    
                    div.addEventListener('click', () => {
                        currentCoin = coin.id;
                        currentCoinName = coin.name;
                        priceDisplay.loadPrice(currentCoin, currentCoinName);
                        searchInput.value = coin.name;
                        searchResults.style.display = 'none';
                    });
                    
                    searchResults.appendChild(div);
                });
                searchResults.style.display = 'block';
            } else {
                searchResults.style.display = 'none';
            }
        }, 300);
    });

    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    // Buy button event listener
    document.getElementById('buyBtn').addEventListener('click', async () => {
        const usdAmount = parseFloat(document.getElementById('amount').value);
        if (usdAmount > 0) {
            try {
                await updatePrice();
                const result = await trading.buy(currentCoin, usdAmount, currentPrice);
                alert(
                    `Transaction successful!\n\n` +
                    `Bought: ${result.tokenAmount.toFixed(8)} ${currentCoin}\n` +
                    `Spent: $${result.usdAmount.toFixed(2)}\n` +
                    `Price per token: $${result.price.toFixed(2)}`
                );
                document.getElementById('amount').value = '';
            } catch (error) {
                alert(error.message);
            }
        }
    });

    // Sell button event listener
    document.getElementById('sellBtn').addEventListener('click', async () => {
        const usdAmount = parseFloat(document.getElementById('amount').value);
        if (usdAmount > 0) {
            try {
                await updatePrice();
                const result = await trading.sell(currentCoin, usdAmount, currentPrice);
                alert(
                    `Transaction successful!\n\n` +
                    `Sold: ${result.tokenAmount.toFixed(8)} ${currentCoin}\n` +
                    `Received: $${result.usdAmount.toFixed(2)}\n` +
                    `Price per token: $${result.price.toFixed(2)}`
                );
                document.getElementById('amount').value = '';
            } catch (error) {
                alert(error.message);
            }
        }
    });

    // Sell all button event listener
    document.getElementById('sellAllBtn').addEventListener('click', async () => {
        try {
            await updatePrice();
            
            // Get current holdings for this coin
            const holdings = trading.getHoldingsForCoin(currentCoin);
            
            if (!holdings) {
                throw new Error(`No ${currentCoin} holdings to sell`);
            }

            const usdValue = holdings.amount * currentPrice;
            
            if (confirm(`Are you sure you want to sell all your ${currentCoin} holdings?\n\nAmount: ${holdings.amount.toFixed(8)} ${currentCoin}\nValue: $${usdValue.toFixed(2)}`)) {
                const result = await trading.sell(currentCoin, usdValue, currentPrice);
                alert(
                    `Sold all holdings successfully!\n\n` +
                    `Sold: ${result.tokenAmount.toFixed(8)} ${currentCoin}\n` +
                    `Received: $${result.usdAmount.toFixed(2)}\n` +
                    `Price per token: $${result.price.toFixed(2)}`
                );
                document.getElementById('amount').value = '';
            }
        } catch (error) {
            alert(error.message);
        }
    });

    // Check if the token list exists
    const tokenList = document.getElementById('tokenList');
    console.log('Token List Element:', tokenList); // Log the token list element

    if (!tokenList) {
        console.error("Token list not found");
        return;
    }

    tokenList.addEventListener('click', (event) => {
        const target = event.target;
        if (target.tagName === 'LI') {
            const coinId = target.getAttribute('data-coin-id');
            const coinName = target.textContent;
            console.log(`Loading chart for: ${coinName} (ID: ${coinId})`); // Log the clicked token
            chart.loadChart(coinId, coinName); // Load the chart for the selected token
        }
    });

    const portfolioElement = document.getElementById('portfolio');
    console.log(portfolioElement); // Check if this logs null or the element
}); 