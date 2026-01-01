const marketData = {
            rates: {},
            lastUpdate: null
        };

        // Récupération des taux Forex en temps réel via Frankfurter API (gratuite et fiable)
        async function fetchForexRates() {
            try {
                const response = await fetch('https://api.frankfurter.app/latest?from=EUR');
                const data = await response.json();
                
                marketData.rates.EUR_USD = data.rates.USD;
                marketData.rates.EUR_GBP = data.rates.GBP;
                marketData.rates.EUR_AUD = data.rates.AUD;
                marketData.rates.EUR_JPY = data.rates.JPY;
                marketData.rates.EUR_CAD = data.rates.CAD;
                
                marketData.lastUpdate = new Date();
                return true;
            } catch (error) {
                console.error('Erreur Forex API:', error);
                return false;
            }
        }

        // Récupération du prix de l'or via API Metals
        async function fetchGoldPrice() {
            try {
                const response = await fetch('https://api.metals.live/v1/spot/gold');
                const data = await response.json();
                marketData.rates.XAU_USD = data[0].price;
                return true;
            } catch (error) {
                console.error('Erreur Gold API:', error);
                // Prix de secours approximatif
                marketData.rates.XAU_USD = 2050;
                return false;
            }
        }

        // Récupération du prix du pétrole via API alternative
        async function fetchOilPrice() {
            try {
                // Utilisation de l'API CoinGecko qui propose aussi des commodities
                const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=crude-oil-brent&vs_currencies=usd');
                const data = await response.json();
                marketData.rates.OIL_USD = data['crude-oil-brent']?.usd || 80;
                return true;
            } catch (error) {
                console.error('Erreur Oil API:', error);
                // Prix de secours
                marketData.rates.OIL_USD = 80;
                return false;
            }
        }

        // Fonction pour calculer le prix actuel d'une paire
        function getCurrentPrice(instrument) {
            switch(instrument) {
                case 'EURUSD':
                    return marketData.rates.EUR_USD;
                case 'GBPUSD':
                    return marketData.rates.EUR_USD / marketData.rates.EUR_GBP;
                case 'AUDUSD':
                    return marketData.rates.EUR_USD / marketData.rates.EUR_AUD;
                case 'USDJPY':
                    return marketData.rates.EUR_JPY / marketData.rates.EUR_USD;
                case 'USDCAD':
                    return marketData.rates.EUR_CAD / marketData.rates.EUR_USD;
                case 'XAUUSD':
                    return marketData.rates.XAU_USD;
                case 'USOIL':
                    return marketData.rates.OIL_USD;
                default:
                    return 1;
            }
        }

        // Calcul de la valeur d'un pip en USD pour 1 lot standard (100 000 unités)
        function getPipValue(instrument, lotSize, currentPrice) {
            let pipValuePerLot;
            
            switch(instrument) {
                case 'EURUSD':
                case 'GBPUSD':
                case 'AUDUSD':
                    // Pour les paires XXX/USD: 1 pip = 0.0001
                    // 1 lot = 100 000 unités
                    // Valeur pip = 100 000 × 0.0001 = 10 USD par lot
                    pipValuePerLot = 10;
                    break;
                case 'USDJPY':
                case 'USDCAD':
                    // Pour les paires USD/XXX: 1 pip = 0.01 pour JPY, 0.0001 pour CAD
                    // La valeur dépend du taux de change actuel
                    if (instrument === 'USDJPY') {
                        // 1 pip JPY = 0.01, donc (100 000 × 0.01) / taux = valeur en USD
                        pipValuePerLot = 1000 / currentPrice;
                    } else {
                        // USDCAD: (100 000 × 0.0001) / taux
                        pipValuePerLot = 10 / currentPrice;
                    }
                    break;
                case 'XAUUSD':
                    // Or: 1 lot = 100 oz, 1 pip = 0.01
                    // Valeur pip = 100 × 0.01 = 1 USD par lot
                    pipValuePerLot = 10;
                    break;
                case 'USOIL':
                    // Pétrole: 1 lot = 1000 barils, 1 pip = 0.01
                    // Valeur pip = 1000 × 0.01 = 10 USD par lot
                    pipValuePerLot = 1;
                    break;
                default:
                    pipValuePerLot = 10;
            }
            
            return pipValuePerLot * lotSize;
        }

        // Conversion USD vers EUR
        function usdToEur(amountUsd) {
            return amountUsd / marketData.rates.EUR_USD;
        }

        async function calculateLot() {
            const instrument = document.getElementById('instrument').value;
            const capital = parseFloat(document.getElementById('capital').value);
            const risk = parseFloat(document.getElementById('risk').value);
            const stopLoss = parseFloat(document.getElementById('stopLoss').value);

            if (!capital || !risk || !stopLoss) {
                document.getElementById('calculatorResult').innerHTML = 
                    '<div class="error">Veuillez remplir tous les champs</div>';
                return;
            }

            document.getElementById('calculatorResult').innerHTML = 
                '<div class="loading">Récupération des données de marché en temps réel...</div>';

            // Récupération de toutes les données de marché
            await Promise.all([
                fetchForexRates(),
                fetchGoldPrice(),
                fetchOilPrice()
            ]);

            const currentPrice = getCurrentPrice(instrument);
            const riskAmount = capital * (risk / 100);
            
            // Pour 1 lot standard, calculer la valeur d'un pip en USD
            const pipValuePerLotUsd = getPipValue(instrument, 1, currentPrice);
            const pipValuePerLotEur = usdToEur(pipValuePerLotUsd);
            
            // Formule: Lot Size = Risque en EUR / (Stop Loss en pips × Valeur d'1 pip en EUR)
            const lotSize = riskAmount / (stopLoss * pipValuePerLotEur);
            
            // Calculer les valeurs finales avec la taille de lot trouvée
            const finalPipValueUsd = getPipValue(instrument, lotSize, currentPrice);
            const finalPipValueEur = usdToEur(finalPipValueUsd);
            
            const totalRiskEur = stopLoss * finalPipValueEur;

            const result = `
                <div class="result">
                    <div class="result-item">
                        <span class="result-label">Instrument:</span>
                        <span class="result-value">${instrument}</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Prix actuel:</span>
                        <span class="result-value">${currentPrice.toFixed(instrument === 'USDJPY' ? 3 : 5)}</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Montant à risquer:</span>
                        <span class="result-value">${riskAmount.toFixed(2)} €</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Taille du lot:</span>
                        <span class="result-value">${lotSize.toFixed(2)} lots</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Mini lots (0.1):</span>
                        <span class="result-value">${(lotSize * 10).toFixed(1)}</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Micro lots (0.01):</span>
                        <span class="result-value">${(lotSize * 100).toFixed(0)}</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Valeur d'1 pip (pour votre lot):</span>
                        <span class="result-value">${finalPipValueEur.toFixed(4)} € (${finalPipValueUsd.toFixed(4)} $)</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Risque total avec SL:</span>
                        <span class="result-value">${totalRiskEur.toFixed(2)} €</span>
                    </div>
                    <div class="rate-info">
                        Taux EUR/USD: ${marketData.rates.EUR_USD.toFixed(5)} | 
                        Dernière mise à jour: ${marketData.lastUpdate.toLocaleTimeString('fr-FR')}
                    </div>
                </div>
            `;

            document.getElementById('calculatorResult').innerHTML = result;
        }

        async function generateTable() {
            const capital = parseFloat(document.getElementById('tableCapital').value);
            const risk = parseFloat(document.getElementById('tableRisk').value);

            if (!capital || !risk) {
                document.getElementById('tableResult').innerHTML = 
                    '<div class="error">Veuillez remplir le capital et le risque</div>';
                return;
            }

            document.getElementById('tableResult').innerHTML = 
                '<div class="loading">Génération du tableau avec données de marché en temps réel...</div>';

            // Récupération de toutes les données de marché
            await Promise.all([
                fetchForexRates(),
                fetchGoldPrice(),
                fetchOilPrice()
            ]);

            const instruments = ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDJPY', 'USDCAD', 'XAUUSD', 'USOIL'];
            const riskAmount = capital * (risk / 100);

            // Générer les colonnes de 1 à 500 (affichage par tranche pour la lisibilité)
            let tableHTML = `
                <div class="rate-info" style="margin-bottom: 15px;">
                    Taux EUR/USD: ${marketData.rates.EUR_USD.toFixed(5)} | 
                    Or: ${marketData.rates.XAU_USD.toFixed(2)} $/oz | 
                    Pétrole: ${marketData.rates.OIL_USD.toFixed(2)} $/baril |
                    Mise à jour: ${marketData.lastUpdate.toLocaleTimeString('fr-FR')}
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Instrument</th>
            `;

            // Créer les en-têtes pour SL de 1 à 500
            for (let sl = 1; sl <= 500; sl++) {
                tableHTML += `<th>${sl}</th>`;
            }
            tableHTML += `</tr></thead><tbody>`;

            // Calculer pour chaque instrument
            for (const instrument of instruments) {
                const currentPrice = getCurrentPrice(instrument);
                tableHTML += `<tr><td>${instrument}</td>`;
                
                for (let stopLoss = 1; stopLoss <= 500; stopLoss++) {
                    const pipValuePerLotUsd = getPipValue(instrument, 1, currentPrice);
                    const pipValuePerLotEur = usdToEur(pipValuePerLotUsd);
                    const lotSize = riskAmount / (stopLoss * pipValuePerLotEur);
                    tableHTML += `<td>${lotSize.toFixed(3)}</td>`;
                }
                
                tableHTML += `</tr>`;
            }

            tableHTML += `</tbody></table></div>`;

            document.getElementById('tableResult').innerHTML = tableHTML;
        }

        // Charger les données au démarrage
        (async () => {
            await Promise.all([
                fetchForexRates(),
                fetchGoldPrice(),
                fetchOilPrice()
            ]);
            console.log('Données de marché chargées:', marketData);
        })();

        // Actualiser les données toutes les 5 minutes
        setInterval(async () => {
            await Promise.all([
                fetchForexRates(),
                fetchGoldPrice(),
                fetchOilPrice()
            ]);
            console.log('Données actualisées:', marketData);
        }, 300000);
