class TradingSimulator {
    constructor(initialBalance = 10000) {
        // Load saved data
        const savedData = this.loadFromLocalStorage();
        
        // Initialize with saved data or defaults
        if (savedData && typeof savedData.balance === 'number') {
            // Only use initialBalance if there's no saved data
            this.balance = savedData.balance;
            this.portfolio = savedData.portfolio || {};
            this.trades = savedData.trades || [];
            this.totalPnL = savedData.totalPnL || {
                realized: 0,
                unrealized: 0
            };
            
            console.log('Loaded saved balance:', this.balance); // Debug log
        } else {
            // First time initialization
            this.balance = initialBalance;
            this.portfolio = {};
            this.trades = [];
            this.totalPnL = {
                realized: 0,
                unrealized: 0
            };
            
            // Save initial state
            this.saveToLocalStorage();
            console.log('Initialized with default balance:', this.balance); // Debug log
        }

        // Initialize other properties
        this.api = new CryptoAPI();
        this.purchaseHistory = {};
        this.onCoinSelect = null;

        // Debug logs
        console.log('Current portfolio:', this.portfolio);
        console.log('Current balance:', this.balance);

        // Add UI elements
        this.addResetBalanceButton();
        this.addCloseAllButton();

        // Start portfolio price updates
        this.startLivePriceUpdates();
    }

    // Add method to validate and fix data
    validateAndFixData() {
        // Fix balance
        this.balance = parseFloat(this.balance);
        if (isNaN(this.balance)) {
            this.balance = 10000;
        }

        // Fix portfolio data
        for (const coinId in this.portfolio) {
            const holding = this.portfolio[coinId];
            this.portfolio[coinId] = {
                amount: parseFloat(holding.amount) || 0,
                averagePrice: parseFloat(holding.averagePrice) || 0,
                currentPrice: parseFloat(holding.currentPrice) || 0
            };
        }

        // Fix trades data
        this.trades = this.trades.map(trade => ({
            ...trade,
            tokenAmount: parseFloat(trade.tokenAmount) || 0,
            usdAmount: parseFloat(trade.usdAmount) || 0,
            price: parseFloat(trade.price) || 0,
            timestamp: parseInt(trade.timestamp) || Date.now()
        }));

        // Save the fixed data
        this.saveToLocalStorage();
    }

    // Add method to set the callback
    setOnCoinSelect(callback) {
        this.onCoinSelect = callback;
    }

    calculateTotalPortfolioValue() {
        let totalValue = 0;
        for (const holdings of Object.values(this.portfolio)) {
            totalValue += holdings.amount * holdings.currentPrice;
        }
        return totalValue;
    }

    calculateTotalPnL() {
        let unrealizedPnL = 0;
        let realizedPnL = this.totalPnL.realized || 0;

        // Calculate unrealized PnL from current holdings
        for (const [coinId, holdings] of Object.entries(this.portfolio)) {
            const { profitLoss } = this.calculateProfitLoss(holdings);
            unrealizedPnL += profitLoss;
        }

        // Calculate realized PnL from closed trades
        const closedTradesPnL = this.trades
            .filter(trade => trade.type === 'sell')
            .reduce((total, trade) => {
                const soldValue = trade.usdAmount; // Amount received from the sale
                const costBasis = trade.tokenAmount * this.getAveragePurchasePrice(trade.coinId, trade.timestamp); // Cost basis for sold tokens
                return total + (soldValue - costBasis); // Calculate profit/loss for this trade
            }, 0);

        // Update total realized PnL
        realizedPnL = closedTradesPnL;

        // Store the updated realized PnL
        this.totalPnL.realized = realizedPnL;

        return {
            realized: realizedPnL,
            unrealized: unrealizedPnL,
            total: realizedPnL + unrealizedPnL
        };
    }

    // Add save to localStorage method
    saveToLocalStorage() {
        const dataToSave = {
            balance: this.balance,
            portfolio: this.portfolio,
            trades: this.trades,
            totalPnL: this.totalPnL,
            lastUpdated: new Date().toISOString()
        };
        try {
            localStorage.setItem('tradingSimulatorData', JSON.stringify(dataToSave));
            console.log('Saved data:', dataToSave); // Debug log
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    // Add load from localStorage method
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('tradingSimulatorData');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                // Validate the balance is a number
                if (parsedData && typeof parsedData.balance === 'number') {
                    console.log('Loading saved data:', parsedData); // Debug log
                    return parsedData;
                }
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            localStorage.removeItem('tradingSimulatorData');
        }
        return null;
    }

    // Add reset method
    reset() {
        if (confirm('Are you sure you want to reset all trading data? This cannot be undone.')) {
            console.log('Resetting all trading data...'); // Debug log

            // Reset balance and portfolio
            this.balance = 10000;
            this.portfolio = {};
            this.trades = [];
            
            // Clear local storage
            localStorage.removeItem('tradingSimulatorData'); // Remove specific key

            // Update UI
            this.updateUI();

            // Reset the PNL section
            const pnlValueElement = document.getElementById('pnlValue');
            if (pnlValueElement) {
                pnlValueElement.textContent = 'PNL: $0.00'; // Reset PNL to zero
            }

            alert('All trading data has been reset, including your PNL.');
        }
    }

    addResetBalanceButton() {
        const balanceDisplay = document.getElementById('balance').parentElement;
        
        // Create reset balance button
        const resetBalanceBtn = document.createElement('button');
        resetBalanceBtn.id = 'resetBalanceBtn';
        resetBalanceBtn.className = 'reset-balance-btn';
        resetBalanceBtn.innerHTML = '↻ Reset All';
        
        // Add tooltip to explain what reset does
        resetBalanceBtn.title = 'Reset balance to $10,000 and clear all holdings';
        
        // Add click handler
        resetBalanceBtn.addEventListener('click', () => this.resetBalance());
        
        // Add button next to balance
        balanceDisplay.appendChild(resetBalanceBtn);
    }

    resetBalance() {
        if (confirm('Are you sure you want to reset your balance to $10,000? This will also clear all your current holdings and trading history.')) {
            // Clear the price update interval
            if (this.priceUpdateInterval) {
                clearInterval(this.priceUpdateInterval);
            }
            
            // Reset everything to initial state
            this.balance = 10000;
            this.portfolio = {};
            this.trades = [];
            
            // Restart price updates
            this.startLivePriceUpdates();
            
            // Save the reset state
            this.saveToLocalStorage();
            
            // Update UI
            this.updateUI();
            
            // Clear chart indicators
            const chartCanvas = document.getElementById('priceChart');
            if (chartCanvas && chartCanvas.__chartInstance) {
                const chartInstance = chartCanvas.__chartInstance;
                if (chartInstance.chart) {
                    // Clear all annotations
                    chartInstance.chart.options.plugins.annotation.annotations = {};
                    // Force chart update
                    chartInstance.chart.update('none'); // Use 'none' for faster update
                }
            }
            
            // Clear current price display
            const currentPriceDisplay = document.getElementById('currentPrice');
            if (currentPriceDisplay) {
                currentPriceDisplay.remove();
            }

            // Clear trade indicators from localStorage
            try {
                const savedData = JSON.parse(localStorage.getItem('tradingSimulatorData'));
                if (savedData) {
                    savedData.trades = [];
                    localStorage.setItem('tradingSimulatorData', JSON.stringify(savedData));
                }
            } catch (error) {
                console.error('Error clearing trade history from localStorage:', error);
            }

            // Reset the PNL section
            const pnlValueElement = document.getElementById('pnlValue');
            if (pnlValueElement) {
                pnlValueElement.textContent = 'PNL: $0.00'; // Reset PNL to zero
            }

            // Force chart recreation if there's a current coin selected
            if (window.currentCoin && window.updateChart) {
                window.updateChart();
            }
            
            alert('Your balance has been reset to $10,000 and all holdings and trading history have been cleared.');
        }
    }

    async buy(coinId, usdAmount, price) {
        // Ensure we're working with numbers
        usdAmount = parseFloat(usdAmount);
        price = parseFloat(price);
        
        if (isNaN(usdAmount) || isNaN(price) || usdAmount <= 0 || price <= 0) {
            throw new Error('Invalid amount or price');
        }

        if (usdAmount > this.balance) {
            throw new Error(`Insufficient funds. Available: $${this.balance.toFixed(2)}`);
        }

        // Calculate token amount from USD amount
        const tokenAmount = usdAmount / price;
        
        // Update balance
        this.balance -= usdAmount;
        
        // Update or create portfolio entry
        if (!this.portfolio[coinId]) {
            this.portfolio[coinId] = {
                amount: 0,
                averagePrice: 0,
                currentPrice: price
            };
        }
        
        // Update average price and amount
        const totalValue = (this.portfolio[coinId].amount * this.portfolio[coinId].averagePrice) + usdAmount;
        const totalAmount = this.portfolio[coinId].amount + tokenAmount;
        this.portfolio[coinId].averagePrice = totalValue / totalAmount;
        this.portfolio[coinId].amount = totalAmount;
        this.portfolio[coinId].currentPrice = price;

        // Record the trade
        this.trades.push({
            type: 'buy',
            coinId,
            tokenAmount,
            usdAmount,
            price,
            timestamp: Date.now()
        });

        // Save state
        this.saveToLocalStorage();
        
        // Update UI
        await this.updateUI();
        this.updateChartIndicators(coinId);

        // Return token amount for display
        return {
            tokenAmount,
            usdAmount,
            price
        };
    }

    async sell(coinId, usdAmount, price) {
        // Ensure we're working with numbers
        usdAmount = parseFloat(usdAmount);
        price = parseFloat(price);
        
        if (isNaN(usdAmount) || isNaN(price) || usdAmount <= 0 || price <= 0) {
            throw new Error('Invalid amount or price');
        }

        // Calculate token amount from USD amount
        const tokenAmount = usdAmount / price;
        
        // Check if user has enough tokens
        if (!this.portfolio[coinId] || this.portfolio[coinId].amount < tokenAmount) {
            throw new Error(`Insufficient ${coinId} balance. Available: ${this.portfolio[coinId]?.amount.toFixed(8) || 0} tokens`);
        }

        // Update balance
        this.balance += usdAmount;
        
        // Update portfolio
        this.portfolio[coinId].amount -= tokenAmount;
        this.portfolio[coinId].currentPrice = price;
        
        // Record the trade
        this.trades.push({
            type: 'sell',
            coinId,
            tokenAmount,
            usdAmount,
            price,
            timestamp: Date.now()
        });

        // Remove coin from portfolio if balance is essentially zero
        if (this.portfolio[coinId].amount < 0.00000001) {
            delete this.portfolio[coinId];
        }
        
        // Calculate realized PnL for this sale
        const position = this.portfolio[coinId];
        const realizedPnL = usdAmount - (tokenAmount * position.averagePrice);
        this.totalPnL.realized += realizedPnL;

        // Save state including realized PnL
        this.saveToLocalStorage();
        
        // Update UI
        await this.updateUI();
        this.updateChartIndicators(coinId);

        // Return token amount for display
        return {
            tokenAmount,
            usdAmount,
            price,
            realizedPnL
        };
    }

    calculateProfitLoss(coin) {
        const currentValue = coin.amount * coin.currentPrice;
        const investedValue = coin.amount * coin.averagePrice;
        const profitLoss = currentValue - investedValue;
        const percentageChange = ((currentValue / investedValue) - 1) * 100;
        
        return {
            profitLoss,
            percentageChange,
            currentValue
        };
    }

    async updateUI() {
        document.getElementById('balance').textContent = this.balance.toFixed(2);
        
        const holdingsDiv = document.getElementById('holdings');
        holdingsDiv.innerHTML = '';

        // Calculate total PnL
        const pnl = this.calculateTotalPnL();
        
        // Add portfolio summary section with PnL
        const totalValue = this.calculateTotalPortfolioValue();
        const portfolioSummary = document.createElement('div');
        portfolioSummary.className = 'portfolio-summary';
        portfolioSummary.innerHTML = `
            <div class="summary-details">
                <div class="summary-item">
                    <span class="summary-label">Cash Balance:</span>
                    <span class="summary-value">$${this.balance.toFixed(2)}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Portfolio Value:</span>
                    <span class="summary-value">$${totalValue.toFixed(2)}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Realized P&L:</span>
                    <span class="summary-value ${pnl.realized >= 0 ? 'profit' : 'loss'}">
                        ${pnl.realized >= 0 ? '+' : ''}$${pnl.realized.toFixed(2)}
                    </span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Unrealized P&L:</span>
                    <span class="summary-value ${pnl.unrealized >= 0 ? 'profit' : 'loss'}">
                        ${pnl.unrealized >= 0 ? '+' : ''}$${pnl.unrealized.toFixed(2)}
                    </span>
                </div>
                <div class="summary-item total">
                    <span class="summary-label">Total P&L:</span>
                    <span class="summary-value ${pnl.total >= 0 ? 'profit' : 'loss'}">
                        ${pnl.total >= 0 ? '+' : ''}$${pnl.total.toFixed(2)}
                    </span>
                </div>
                <div class="summary-item total">
                    <span class="summary-label">Total Value:</span>
                    <span class="summary-value">$${(this.balance + totalValue).toFixed(2)}</span>
                </div>
            </div>
        `;
        holdingsDiv.appendChild(portfolioSummary);
        
        // Add individual holdings with live price indicators
        for (const [coinId, holdings] of Object.entries(this.portfolio)) {
            const { profitLoss, percentageChange, currentValue } = this.calculateProfitLoss(holdings);
            
            const holdingDiv = document.createElement('div');
            holdingDiv.className = `holding-item clickable ${coinId === window.currentCoin ? 'selected' : ''}`;
            
            const profitLossClass = profitLoss >= 0 ? 'profit' : 'loss';
            const arrow = profitLoss >= 0 ? '↑' : '↓';
            
            holdingDiv.innerHTML = `
                <div class="holding-details">
                    <div class="holding-main">
                        <span class="coin-name" data-coin-id="${coinId}">${coinId}</span>
                        <span class="live-price-indicator"></span>
                    </div>
                    <span class="amount">${holdings.amount.toFixed(2)}</span>
                    <span class="value">Value: $${currentValue.toFixed(2)}</span>
                    <div class="price-info">
                        <span class="avg-price">Avg: $${holdings.averagePrice.toFixed(2)}</span>
                        <span class="current-price">Current: $${holdings.currentPrice.toFixed(2)}</span>
                    </div>
                    <span class="pnl ${profitLossClass}">
                        ${arrow} ${Math.abs(percentageChange).toFixed(2)}%
                        ($${Math.abs(profitLoss).toFixed(2)})
                    </span>
                </div>
            `;
            
            // Update click event listener to load chart
            holdingDiv.addEventListener('click', async () => {
                // Update selection highlight
                document.querySelectorAll('.holding-item').forEach(item => {
                    item.classList.remove('selected');
                });
                holdingDiv.classList.add('selected');
                
                // Set current coin and update chart
                window.currentCoin = coinId;
                window.currentCoinName = coinId.toUpperCase(); // or get actual name if available
                
                // Update chart if updateChart function exists
                if (typeof window.updateChart === 'function') {
                    await window.updateChart(coinId);
                }
                
                // Update chart indicators
                this.updateChartIndicators(coinId);
                
                // Dispatch event for other components
                document.dispatchEvent(new CustomEvent('coinSelected', {
                    detail: { coinId, coinName: coinId.toUpperCase() }
                }));
                
                // Call onCoinSelect callback if it exists
                if (this.onCoinSelect) {
                    this.onCoinSelect(coinId);
                }
            });
            
            holdingsDiv.appendChild(holdingDiv);
        }

        // Add close all button at the bottom
        if (Object.keys(this.portfolio).length > 0) {
            if (this.closeAllButton) {
                holdingsDiv.appendChild(this.closeAllButton);
            }
        }
    }

    updateChartIndicators(coinId) {
        // Skip if there are no trades
        if (!this.trades || this.trades.length === 0) {
            return;
        }

        const chartCanvas = document.getElementById('priceChart');
        if (!chartCanvas || !chartCanvas.__chartInstance) {
            return;
        }

        const chartInstance = chartCanvas.__chartInstance;
        if (!chartInstance.chart) {
            return;
        }

        // Filter trades for current coin
        const coinTrades = this.trades.filter(trade => trade.coinId === coinId);
        
        // Create annotations for each trade
        const annotations = coinTrades.map((trade, index) => ({
            type: 'point',
            xValue: new Date(trade.timestamp).toLocaleString(),
            yValue: trade.price,
            backgroundColor: trade.type === 'buy' ? 'green' : 'red',
            borderColor: trade.type === 'buy' ? 'darkgreen' : 'darkred',
            borderWidth: 2,
            radius: 8,
            label: {
                content: trade.type === 'buy' ? '↑ BUY' : '↓ SELL',
                enabled: true,
                position: trade.type === 'buy' ? 'top' : 'bottom',
                yAdjust: trade.type === 'buy' ? -20 : 20,
                backgroundColor: trade.type === 'buy' ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)',
                color: 'white',
                padding: 4
            }
        }));

        // Update chart annotations
        chartInstance.chart.options.plugins.annotation.annotations = annotations;
        chartInstance.chart.update('none'); // Use 'none' for faster update
    }

    startLivePriceUpdates() {
        // Update prices every 15 seconds
        this.priceUpdateInterval = setInterval(async () => {
            await this.updatePortfolioPrices();
        }, 15000);

        // Initial update
        this.updatePortfolioPrices();
    }

    async updatePortfolioPrices() {
        try {
            for (const coinId in this.portfolio) {
                const priceData = await api.getCoinPrice(coinId);
                if (priceData && priceData.usd) {
                    this.portfolio[coinId].currentPrice = priceData.usd;
                }
            }
            await this.updateUI();
        } catch (error) {
            console.error('Error updating portfolio prices:', error);
        }
    }

    getHoldingsForCoin(coinId) {
        return this.portfolio[coinId] || null;
    }

    initializeElements() {
        this.amountInput = document.getElementById('amountInput');
        if (!this.amountInput) {
            this.amountInput = document.getElementById('amount');
        }
        this.buyButton = document.getElementById('buyBtn');
        this.sellButton = document.getElementById('sellBtn');
        this.sellAllButton = document.getElementById('sellAllBtn');
        this.portfolioElement = document.getElementById('holdings');
        this.balanceElement = document.getElementById('balance');
    }

    async updateSelectedCoin(coinId, coinName) {
        try {
            if (!coinId || !coinName) return;

            const priceData = await this.api.getCoinPrice(coinId);
            if (!priceData || !priceData.usd) return;

            this.updateUI();
        } catch (error) {
            console.error('Error updating selected coin:', error);
        }
    }

    addCloseAllButton() {
        // Remove any existing close all button
        const existingBtn = document.getElementById('closeAllBtn');
        if (existingBtn) {
            existingBtn.remove();
        }

        const closeAllBtn = document.createElement('button');
        closeAllBtn.id = 'closeAllBtn';
        closeAllBtn.className = 'close-all-btn';
        closeAllBtn.innerHTML = '🔄 Close All Positions';
        closeAllBtn.title = 'Sell all current holdings';
        
        closeAllBtn.addEventListener('click', () => this.closeAllPositions());

        // Add button at the end of updateUI method
        this.closeAllButton = closeAllBtn; // Store reference
    }

    async closeAllPositions() {
        if (Object.keys(this.portfolio).length === 0) {
            alert('No positions to close');
            return;
        }

        if (!confirm('Are you sure you want to close all positions? This will sell all your holdings at current market prices.')) {
            return;
        }

        try {
            let totalRealized = 0;
            const positions = { ...this.portfolio }; // Create copy to avoid modification during iteration

            for (const [coinId, holdings] of Object.entries(positions)) {
                try {
                    // Use the CryptoAPI instance
                    const api = new CryptoAPI();
                    const priceData = await api.getCoinPrice(coinId);
                    
                    if (!priceData || !priceData.usd) {
                        console.error(`Could not get price for ${coinId}`);
                        continue;
                    }

                    const price = priceData.usd;
                    const usdAmount = holdings.amount * price;
                    const realizedPnL = usdAmount - (holdings.amount * holdings.averagePrice);
                    
                    // Update balance
                    this.balance += usdAmount;
                    totalRealized += realizedPnL;

                    // Record the trade
                    this.trades.push({
                        type: 'sell',
                        coinId,
                        tokenAmount: holdings.amount,
                        usdAmount,
                        price,
                        timestamp: Date.now()
                    });

                    // Remove from portfolio
                    delete this.portfolio[coinId];
                    
                    console.log(`Closed position for ${coinId}:`, {
                        amount: holdings.amount,
                        price,
                        usdAmount,
                        realizedPnL
                    });
                } catch (error) {
                    console.error(`Error closing position for ${coinId}:`, error);
                }
            }

            // Update total realized PnL
            this.totalPnL.realized += totalRealized;

            // Save state
            this.saveToLocalStorage();
            
            // Update UI
            await this.updateUI();

            // Show result
            alert(`Successfully closed all positions\nTotal Realized P&L: ${totalRealized >= 0 ? '+' : ''}$${totalRealized.toFixed(2)}`);
        } catch (error) {
            console.error('Error closing all positions:', error);
            alert('Error closing all positions. Please try again.');
        }
    }

    getAveragePurchasePrice(coinId, saleTimestamp) {
        const relevantBuys = this.trades
            .filter(trade => 
                trade.coinId === coinId && 
                trade.type === 'buy' && 
                trade.timestamp < saleTimestamp
            );

        if (relevantBuys.length === 0) return 0;

        const totalValue = relevantBuys.reduce((sum, trade) => sum + (trade.tokenAmount * trade.price), 0);
        const totalTokens = relevantBuys.reduce((sum, trade) => sum + trade.tokenAmount, 0);

        return totalValue / totalTokens; // Return average purchase price
    }
}

function renderTradingTokens(tradingPortfolio) {
    const tradingContainer = document.getElementById('tradingPortfolio');
    tradingContainer.innerHTML = ''; // Clear existing tokens

    for (const [coinId, coinData] of Object.entries(tradingPortfolio)) {
        const li = document.createElement('li');
        li.textContent = `${coinData.name} (${coinData.amount})`; // Display token name and amount
        li.setAttribute('data-coin-id', coinId); // Set data attribute for coin ID

        // Add click event listener to load the chart
        li.addEventListener('click', () => {
            console.log(`Loading chart for: ${coinData.name} (ID: ${coinId})`); // Log the selected token
            chart.loadChart(coinId, coinData.name); // Call loadChart with coin ID and name
        });

        tradingContainer.appendChild(li); // Append the list item to the trading container
    }
}

function renderHoldings(holdings) {
    const holdingsContainer = document.getElementById('holdings');
    holdingsContainer.innerHTML = ''; // Clear existing holdings

    for (const [coinId, coinData] of Object.entries(holdings)) {
        const holdingItem = document.createElement('div');
        holdingItem.className = 'holding-item'; // Ensure this class does not imply clickability

        holdingItem.innerHTML = `
            <div class="holding-details">
                <div class="holding-main">
                    <span class="coin-name">${coinData.name}</span>
                    <span class="live-price-indicator"></span>
                </div>
                <span class="amount">${coinData.amount.toFixed(2)}</span>
                <span class="value">Value: $${coinData.value.toFixed(2)}</span>
                <div class="price-info">
                    <span class="avg-price">Avg: $${coinData.avgPrice.toFixed(2)}</span>
                    <span class="current-price">Current: $${coinData.currentPrice.toFixed(2)}</span>
                </div>
                <span class="pnl ${coinData.pnl < 0 ? 'loss' : 'profit'}">
                    ${coinData.pnl < 0 ? '↓' : '↑'} ${Math.abs(coinData.pnl).toFixed(2)}%
                    ($${Math.abs(coinData.pnlValue).toFixed(2)})
                </span>
                <button class="sell-button" data-coin-id="${coinId}">Sell</button>
            </div>
        `;

        // Remove any click event listeners for holdingItem
        // holdingItem.addEventListener('click', async () => { ... });

        // Add event listener for the sell button
        holdingItem.querySelector('.sell-button').addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent triggering any parent click events
            sellToken(coinId, coinData); // Call the sell function
        });

        holdingsContainer.appendChild(holdingItem); // Append the holding item to the holdings container
    }
}

let priceUpdateInterval; // Variable to hold the interval ID

async function loadTokenPrice(coinId) {
    // Clear any existing price update interval
    if (priceUpdateInterval) {
        clearInterval(priceUpdateInterval);
    }

    try {
        const response = await fetch(`https://cors-anywhere.herokuapp.com/https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
        
        // Check if the response is OK (status code 200)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Token Price:', data);
        const price = data[coinId].usd; // Get the price in USD

        // Update the UI with the token price and ticker
        document.getElementById('tokenTicker').textContent = `Ticker: ${coinId.toUpperCase()}`; // Update ticker
        document.getElementById('tokenPrice').textContent = `Price: $${price.toFixed(2)}`; // Update price

        // Set up the interval to update the price every minute
        priceUpdateInterval = setInterval(async () => {
            const updatedPrice = await fetchTokenPrice(coinId); // Fetch the latest price
            document.getElementById('tokenPrice').textContent = `Price: $${updatedPrice.toFixed(2)}`; // Update price display
        }, 60000); // 60,000 milliseconds = 1 minute

    } catch (error) {
        console.error('Error fetching token price:', error);
        // Optionally, update the UI to show an error message
        document.getElementById('tokenTicker').textContent = 'Ticker: N/A';
        document.getElementById('tokenPrice').textContent = 'Price: N/A';
    }
}

// Function to fetch the current price of the token
async function fetchTokenPrice(coinId) {
    try {
        const response = await fetch(`https://cors-anywhere.herokuapp.com/https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
        
        // Check if the response is OK (status code 200)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Token Price:', data);
        return data[coinId].usd; // Return the price in USD
    } catch (error) {
        console.error('Error fetching token price:', error);
        return 0; // Return 0 if there's an error
    }
}

function selectToken(coinId, coinData) {
    console.log(`Selected Token: ${coinData.name} (${coinData.ticker})`); // Debug log
    selectedToken = coinData; // Set the selected token

    // Update the UI to show the selected token details
    document.getElementById('selectedTokenInfo').innerHTML = `
        <h3>Selected Token: Test Token (TT)</h3>
        <div>Amount: 10</div>
        <button id="sellButton">Sell</button>
        <a id="coingeckoLink" href="https://www.coingecko.com/en/coins/test-token" target="_blank">
            <button id="viewCoinGeckoButton">View on CoinGecko</button>
        </a>
    `;

    // Add event listener to the sell button
    document.getElementById('sellButton').addEventListener('click', () => {
        sellToken(coinId, coinData); // Call the sell function
    });
}

function sellToken(coinId, coinData) {
    const amountToSell = prompt(`How many ${coinData.name} would you like to sell? (Available: ${coinData.amount})`);
    
    if (amountToSell !== null) {
        const amount = parseFloat(amountToSell);
        
        // Validate the input
        if (isNaN(amount) || amount <= 0 || amount > coinData.amount) {
            alert('Invalid amount. Please enter a valid number.');
            return;
        }

        // Calculate the sale value
        const price = coinData.currentPrice; // Assuming you have the current price
        const totalSale = amount * price; // Calculate total sale amount

        // Calculate realized P&L
        const avgPurchasePrice = coinData.avgPrice; // Assuming you have this value stored
        const totalCost = amount * avgPurchasePrice; // Total cost of the sold amount
        const profitLoss = totalSale - totalCost; // Realized P&L from this sale

        // Update the holdings
        coinData.amount -= amount; // Decrease the amount in holdings
        if (coinData.amount <= 0) {
            delete holdings[coinId]; // Remove the token if amount is zero
        }

        // Update the UI
        alert(`Sold ${amount} ${coinData.name} for $${totalSale.toFixed(2)}. Realized P&L: $${profitLoss.toFixed(2)}`);
        renderHoldings(holdings); // Re-render holdings to reflect changes
    }
}

function purchaseToken(coinId, coinName, amount, price) {
    // Check if the coin already exists in holdings
    if (holdings[coinId]) {
        // If it exists, update the amount
        holdings[coinId].amount += amount;
    } else {
        // If it doesn't exist, create a new entry
        holdings[coinId] = {
            name: coinName,
            amount: amount,
            avgPrice: price, // You might want to calculate the average price
            currentPrice: price, // Set the current price
            value: amount * price, // Calculate the total value
            pnl: 0, // Initialize P&L
            pnlValue: 0 // Initialize P&L value
        };
    }

    // Re-render the holdings to reflect the new purchase
    renderHoldings(holdings);
}

document.addEventListener('DOMContentLoaded', (event) => {
    const sellAllButtons = document.querySelectorAll('.sell-all');
    sellAllButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const tokenId = e.target.getAttribute('data-token-id');
            sellAll(tokenId);
        });
    });

    const dropdownItems = document.querySelectorAll('#dropdown li');
    dropdownItems.forEach(item => {
        item.addEventListener('click', function() {
            const tokenId = this.getAttribute('data-token-id');
            handleTokenSelection(tokenId); // Call the function to handle selection
        });
    });

    const body = document.body;

    // Check for saved user preference in localStorage
    const currentTheme = localStorage.getItem('theme') || 'light';
    body.classList.add(currentTheme + '-mode');

    // Example of rendering holdings
    renderHoldings(holdings); // Call your function to render holdings
});

function sellAll(tokenId) {
    // Implement the logic to sell all of the specified token
    console.log(`Selling all of ${tokenId}`);
    
    // Here you can add your logic to handle the sell action, such as:
    // - Updating the holdings data
    // - Making an API call to execute the sell
    // - Updating the UI to reflect the sale

    // Example: Remove the token from the holdings display
    const tokenElement = document.querySelector(`.token[data-token-id="${tokenId}"]`);
    if (tokenElement) {
        tokenElement.remove(); // Remove the token from the DOM
    }
}

// Function to handle token selection
function handleTokenSelection(tokenId) {
    console.log(`Selected token ID: ${tokenId}`);
    fetchTokenData(tokenId); // Fetch data for the selected token
}

// Function to fetch token data
async function fetchTokenData(tokenId) {
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`);
        
        // Check if the response is OK (status code 200)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Token Data:', data);
        
        // Update the trading card with the fetched data
        updateTradingCard(tokenId, data[tokenId]);

        // Assuming you want to update the chart with new data
        const labels = [/* your labels here */]; // Define your labels
        const prices = [data[tokenId].usd]; // Use the fetched price
        updateChart(labels, prices); // Call updateChart with the new data
    } catch (error) {
        console.error('Error fetching token data:', error);
    }
}

// Function to update the trading card
function updateTradingCard(tokenId, tokenData) {
    const tradingCard = document.getElementById('tradingCard'); // Assuming you have a trading card element
    tradingCard.innerHTML = `
        <h2>${tokenId.charAt(0).toUpperCase() + tokenId.slice(1)} Trading Card</h2>
        <p>Price: $${tokenData.usd}</p>
        <!-- Add more data as needed -->
    `;
} 
