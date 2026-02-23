
import { PrismaClient } from '@prisma/client';

// Mocking the heuristic logic for verification since it's private in StatsService
function revalueSaleByPaymentsMock(sale: any, currentRefRate: number, crossRateFactor: number, isTargetVES: boolean) {
    const paymentStr = sale.paymentMethod || 'CASH';
    const parts = paymentStr.split(', ');
    const saleNominalTotal = Number(sale.total);

    let totalInTarget = 0;

    parts.forEach(p => {
        const subparts = p.trim().split(':');
        const method = subparts[0].trim().toUpperCase();
        const subpartsLength = subparts.length;

        let rawAmount = saleNominalTotal;
        let isExplicit = false;
        if (subpartsLength > 1) {
            rawAmount = parseFloat(subparts[1]);
            isExplicit = true;
        }

        const isForeign =
            method === 'ZELLE' ||
            method === 'UDT' ||
            method.startsWith('CURRENCY_') ||
            (method.startsWith('ACCOUNT_CREDIT_') && method !== 'ACCOUNT_CREDIT');

        let paymentVES = 0;
        let paymentUSD = 0;

        if (isForeign && isExplicit) {
            // HEURISTIC APPLIED
            const saleRate = Number(sale.exchangeRate) || currentRefRate;
            const isLikelyMisrepresented = Math.abs(rawAmount - saleNominalTotal) < 0.01 &&
                rawAmount > (saleNominalTotal / saleRate) * 3;

            if (isLikelyMisrepresented) {
                paymentVES = rawAmount;
                paymentUSD = rawAmount / currentRefRate;
                console.log(`[Heuristic] Detected misrepresented amount: ${rawAmount} ${method}. Corrected to VES.`);
            } else {
                paymentUSD = rawAmount;
                paymentVES = rawAmount * currentRefRate;
            }
        } else {
            paymentVES = rawAmount;
            paymentUSD = rawAmount / currentRefRate;
        }

        const amountInTarget = isTargetVES ? paymentVES : (paymentUSD * crossRateFactor);
        totalInTarget += amountInTarget;
    });

    return totalInTarget;
}

async function runTests() {
    const currentRate = 40;

    console.log("--- Test 1: Corrupted Data (Old Bug) ---");
    // Sale of 400 Bs (10 USD). Frontend incorrectly sent CURRENCY_USD:400.00
    const corruptedSale = {
        total: 400,
        exchangeRate: 40,
        paymentMethod: "CURRENCY_USD:400.00"
    };

    const revaluedVES = revalueSaleByPaymentsMock(corruptedSale, currentRate, 1, true);
    console.log(`Corrupted Sale (400 Bs) -> Revalued VES: ${revaluedVES}`);
    if (revaluedVES === 400) {
        console.log("✅ Heuristic SUCCESS: Corrected legacy corrupted data.");
    } else {
        console.log(`❌ Heuristic FAILURE: Expected 400, got ${revaluedVES}`);
    }

    console.log("\n--- Test 2: Correct Data (New Fix) ---");
    // Sale of 400 Bs (10 USD). Frontend correctly sends CURRENCY_USD:10.00
    const cleanSale = {
        total: 400,
        exchangeRate: 40,
        paymentMethod: "CURRENCY_USD:10.00"
    };

    const revaluedVESClean = revalueSaleByPaymentsMock(cleanSale, currentRate, 1, true);
    console.log(`Clean Sale (400 Bs) -> Revalued VES: ${revaluedVESClean}`);
    if (revaluedVESClean === 400) {
        console.log("✅ Success: Correct data handled properly.");
    } else {
        console.log(`❌ Failure: Expected 400, got ${revaluedVESClean}`);
    }

    console.log("\n--- Test 3: Genuine Large USD Payment ---");
    // Sale of 400 Bs (10 USD). User pays with a $100 bill (to get change in BS).
    // CURRENCY_USD:100.00
    const largeUSDSale = {
        total: 400,
        exchangeRate: 40,
        paymentMethod: "CURRENCY_USD:100.00"
    };

    const revaluedVESLarge = revalueSaleByPaymentsMock(largeUSDSale, currentRate, 1, true);
    console.log(`Large USD Sale ($100 for 400 Bs) -> Revalued VES: ${revaluedVESLarge}`);
    // Since he paid $100, and today rate is 40, value should be 4000.
    if (revaluedVESLarge === 4000) {
        console.log("✅ Success: Genuine large payments are NOT incorrectly suppressed by heuristic.");
    } else {
        console.log(`❌ Failure: Expected 4000, got ${revaluedVESLarge}`);
    }
}

runTests();
