const fs = require('fs');
const path = require('path');

const files = [
  'apps/frontend/src/features/banks/components/BankFormModal.tsx',
  'apps/frontend/src/features/banks/components/BankMovementModal.tsx',
  'apps/frontend/src/features/banks/components/LiquidateBatchModal.tsx',
  'apps/frontend/src/features/currencies/CurrencyFormModal.tsx',
  'apps/frontend/src/features/departments/DepartmentFormModal.tsx',
  'apps/frontend/src/features/expenses/components/CreateExpenseModal.tsx',
  'apps/frontend/src/features/hr/components/EmployeeFormModal.tsx',
  'apps/frontend/src/features/hr/components/GeneratePayrollModal.tsx',
  'apps/frontend/src/features/inventory-adjustments/components/CreateAdjustmentModal.tsx',
  'apps/frontend/src/features/products/services/ServiceFormModal.tsx',
  'apps/frontend/src/features/purchases/components/CreateSupplierModal.tsx',
  'apps/frontend/src/features/purchases/components/RegisterPurchasePaymentModal.tsx',
  'apps/frontend/src/features/units/UnitFormModal.tsx',
  'apps/frontend/src/features/users/components/UserFormModal.tsx',
  'apps/frontend/src/features/cash-register/components/AddMovementModal.tsx',
  'apps/frontend/src/features/cash-register/components/CloseSessionModal.tsx',
  'apps/frontend/src/features/cash-register/components/OpenSessionModal.tsx',
  'apps/frontend/src/features/cash-register/components/TransferToTreasuryModal.tsx',
];

let modified = 0;

for (const filePath of files) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${filePath}`);
    continue;
  }
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  
  // Skip if already has F9
  if (content.includes("'F9'")) {
    console.log(`SKIP (already has F9): ${filePath}`);
    continue;
  }
  
  // 1. Ensure useEffect is imported
  if (!content.includes('useEffect')) {
    // Add useEffect to existing react import
    if (content.includes("import { useState } from 'react'")) {
      content = content.replace("import { useState } from 'react'", "import { useState, useEffect } from 'react'");
    } else if (content.includes("from 'react'")) {
      content = content.replace(/import \{([^}]+)\} from 'react'/, (match, imports) => {
        if (!imports.includes('useEffect')) {
          return `import {${imports}, useEffect } from 'react'`;
        }
        return match;
      });
    } else {
      // No react import, add one
      content = "import { useEffect } from 'react';\n" + content;
    }
  }
  
  // 2. Detect the submit function name from onOk=
  const onOkMatch = content.match(/onOk=\{(\w+)\}/);
  if (!onOkMatch) {
    console.log(`SKIP (no onOk handler): ${filePath}`);
    continue;
  }
  const submitFn = onOkMatch[1];
  
  // 3. Detect the open prop name (could be 'open', 'visible', or a prop)
  let openProp = 'open';
  const openMatch = content.match(/open=\{(\w+)\}/);
  if (openMatch) {
    openProp = openMatch[1];
  }
  
  // 4. Add the F9 useEffect before the submit function
  const f9Effect = `
    // F9 Keyboard Shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!${openProp}) return;
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                ${submitFn}();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [${openProp}]);

`;

  // Find the submit function and add the effect before it
  const fnRegex = new RegExp(`(\\n    const ${submitFn} )`);
  if (fnRegex.test(content)) {
    content = content.replace(fnRegex, f9Effect + `    const ${submitFn} `);
  } else {
    // Try inserting before the return statement
    const returnIdx = content.indexOf('\n    return (');
    if (returnIdx > -1) {
      content = content.slice(0, returnIdx) + f9Effect + content.slice(returnIdx);
    } else {
      console.log(`SKIP (can't find insertion point): ${filePath}`);
      continue;
    }
  }
  
  // 5. Update okText to include (F9)
  // Pattern: okText="text"  -> okText="text (F9)"
  content = content.replace(/okText="([^"]+?)"/g, (match, text) => {
    if (text.includes('F9') || text.includes('eliminar') || text.includes('Cancelar')) return match;
    return `okText="${text} (F9)"`;
  });
  
  // Pattern: okText={'text'}  -> no change needed (complex expressions)
  // Pattern: okText={condition ? 'a' : 'b'} -> update both
  content = content.replace(/okText=\{([^}]+)\?([^:]+):([^}]+)\}/g, (match, cond, a, b) => {
    if (match.includes('F9')) return match;
    const aClean = a.trim().replace(/'/g, '').replace(/"/g, '').trim();
    const bClean = b.trim().replace(/'/g, '').replace(/"/g, '').trim();
    return `okText={${cond}? '${aClean} (F9)' : '${bClean} (F9)'}`;
  });
  
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`OK: ${filePath} (onOk=${submitFn}, open=${openProp})`);
  modified++;
}

console.log(`\nDone. Modified ${modified} files.`);
