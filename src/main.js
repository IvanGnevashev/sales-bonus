/**
 * Функция для расчета выручки
 * @param {Object} purchase - запись о покупке
 * @param {Object} _product - карточка товара (не используется)
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount, sale_price, quantity } = purchase;
    
    // Рассчитываем выручку с учетом скидки
    const totalPrice = sale_price * quantity;
    const revenue = totalPrice * (1 - discount / 100);
    
    return Math.round(revenue * 100) / 100;
}

/**
 * Функция для расчета бонусов
 * @param {number} index - порядковый номер в отсортированном массиве
 * @param {number} total - общее число продавцов
 * @param {Object} seller - карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;
    
    // Защита от некорректных данных
    if (!profit || profit <= 0 || index < 0 || total <= 0) {
        return 0;
    }

    // Определяем процент бонуса по месту в рейтинге
    let bonusPercentage;
    
    switch (index) {
        case 0:
            bonusPercentage = 0.15; // 1 место - 15%
            break;
        case 1:
        case 2:
            bonusPercentage = 0.10; // 2-3 место - 10%
            break;
        case total - 1:
            return 0; // Последнее место - 0%
        default:
            bonusPercentage = 0.05; // Остальные - 5%
    }
    
    return profit * bonusPercentage;
}

/**
 * Функция для округления денежных значений
 * @param {number} value - число для округления
 * @returns {number}
 */
const roundMoney = (value) => Math.round(value * 100) / 100;

/**
 * Функция для анализа данных продаж
 * @param {Object} data - входные данные
 * @param {Object} options - опции с функциями расчета
 * @returns {Array} - отчет по продавцам
 */
function analyzeSalesData(data, options) {
    // ===== ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ =====
    validateInputData(data);
    validateOptions(options);
    
    // ===== ИНИЦИАЛИЗАЦИЯ =====
    const { calculateRevenue, calculateBonus } = options;
    
    // Создаем базовую структуру для продавцов
    const sellerStats = createSellerStats(data.sellers);
    
    // Создаем индексы для быстрого доступа
    const { sellerIndex, productIndex } = createIndexes(sellerStats, data.products);
    
    // ===== ОСНОВНЫЕ РАСЧЕТЫ =====
    calculateSellerMetrics(data.purchase_records, sellerIndex, productIndex, calculateRevenue);
    
    // ===== СОРТИРОВКА И БОНУСЫ =====
    sortSellersByProfit(sellerStats);
    calculateBonusesAndTopProducts(sellerStats, calculateBonus);
    
    // ===== ФОРМИРОВАНИЕ РЕЗУЛЬТАТА =====
    return formatResult(sellerStats);
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

/**
 * Проверка входных данных
 * @param {Object} data 
 */
function validateInputData(data) {
    if (!data 
        || !data.sellers || !Array.isArray(data.sellers)
        || !data.products || !Array.isArray(data.products)
        || !data.purchase_records || !Array.isArray(data.purchase_records)
        || data.sellers.length === 0
        || data.products.length === 0
        || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные');
    }
}

/**
 * Проверка опций
 * @param {Object} options 
 */
function validateOptions(options) {
    const { calculateRevenue, calculateBonus } = options || {};

    if (!calculateRevenue || !calculateBonus) {
        throw new Error('Отсутствуют требуемые функции в опциях');
    }

    if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
        throw new Error('calculateRevenue и calculateBonus должны быть функциями');
    }
}

/**
 * Создание статистики по продавцам
 * @param {Array} sellers 
 * @returns {Array}
 */
function createSellerStats(sellers) {
    return sellers.map(seller => ({
        id: seller.id,
        seller_id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        sales_count: 0,
        revenue: 0,
        profit: 0,
        bonus: 0,
        products_sold: {}
    }));
}

/**
 * Создание индексов для быстрого доступа
 * @param {Array} sellerStats 
 * @param {Array} products 
 * @returns {Object}
 */
function createIndexes(sellerStats, products) {
    const sellerIndex = Object.fromEntries(
        sellerStats.map(seller => [seller.id, seller])
    );
    
    const productIndex = Object.fromEntries(
        products.map(product => [product.sku, product])
    );
    
    return { sellerIndex, productIndex };
}

/**
 * Расчет метрик по продавцам
 * @param {Array} purchaseRecords 
 * @param {Object} sellerIndex 
 * @param {Object} productIndex 
 * @param {Function} calculateRevenue 
 */
function calculateSellerMetrics(purchaseRecords, sellerIndex, productIndex, calculateRevenue) {
    purchaseRecords.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;
        
        // Обновляем общую статистику по чеку
        seller.sales_count++;
        seller.revenue += record.total_amount;
        
        // Обрабатываем каждый товар в чеке
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (!product) return;
            
            // Рассчитываем себестоимость и прибыль
            const cost = product.purchase_price * item.quantity;
            const revenue = calculateRevenue(item, product);
            const profit = roundMoney(revenue - cost);
            
            // Обновляем прибыль продавца
            seller.profit = roundMoney(seller.profit + profit);
            
            // Обновляем статистику по товарам
            updateProductsSold(seller.products_sold, item.sku, item.quantity);
        });
        
        // Округляем выручку после обработки чека
        seller.revenue = roundMoney(seller.revenue);
    });
}

/**
 * Обновление счетчика проданных товаров
 * @param {Object} productsSold 
 * @param {string} sku 
 * @param {number} quantity 
 */
function updateProductsSold(productsSold, sku, quantity) {
    productsSold[sku] = (productsSold[sku] || 0) + quantity;
}

/**
 * Сортировка продавцов по прибыли
 * @param {Array} sellerStats 
 */
function sortSellersByProfit(sellerStats) {
    sellerStats.sort((a, b) => b.profit - a.profit);
}

/**
 * Расчет бонусов и формирование топ-10 товаров
 * @param {Array} sellerStats 
 * @param {Function} calculateBonus 
 */
function calculateBonusesAndTopProducts(sellerStats, calculateBonus) {
    sellerStats.forEach((seller, index) => {
        // Расчет бонуса
        const bonus = calculateBonus(index, sellerStats.length, seller);
        seller.bonus = roundMoney(bonus);
        
        // Формирование топ-10 товаров
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });
}

/**
 * Форматирование результата
 * @param {Array} sellerStats 
 * @returns {Array}
 */
function formatResult(sellerStats) {
    return sellerStats.map(({ seller_id, name, revenue, profit, sales_count, top_products, bonus }) => ({
        seller_id,
        name,
        revenue: roundMoney(revenue),
        profit: roundMoney(profit),
        sales_count,
        top_products,
        bonus: roundMoney(bonus)
    }));
}