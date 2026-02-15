
const sale = { id: 'sale-123', invoiceNumber: '001', total: '100.00', exchangeRate: '1' };
const paymentMethodStr = "MOBILE:100.00:5f4d1234-1234-1234-1234-5f4d12345678";

console.log('Testing parsing for:', paymentMethodStr);

function simulateRegister(paymentMethodStr) {
    const methods = paymentMethodStr.split(', ');
    console.log('Methods:', methods);

    for (const methodPart of methods) {
        console.log('Part:', methodPart);
        let method = methodPart;

        let extraData = null;
        if (methodPart.includes(':')) {
            const parts = methodPart.split(':');
            method = parts[0].trim();
            const amount = parseFloat(parts[1]);
            if (parts.length > 2) {
                extraData = parts[2];
            }
            console.log('Parsed:', { method, amount, extraData });

            if (method === 'MOBILE' && extraData) {
                console.log('MATCH! Bank ID:', extraData);
            } else {
                console.log('NO MATCH for MOBILE');
            }
        }
    }
}

simulateRegister(paymentMethodStr);
