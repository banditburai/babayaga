// Performance test for 100 elements
const startTime = Date.now();
const results = [];
let successCount = 0;
let errorCount = 0;

console.log('Starting performance test for 100 elements...');

// Test measuring 100 elements sequentially
for (let i = 1; i <= 100; i++) {
    const measureStart = Date.now();
    try {
        // This will be executed in the browser context
        const selector = `#cell-${i}`;
        console.log(`Measuring element ${i}: ${selector}`);
        
        // Track timing
        const elapsed = Date.now() - measureStart;
        results.push(elapsed);
        successCount++;
        
        // Log progress every 10 elements
        if (i % 10 === 0) {
            console.log(`Progress: ${i}/100 elements measured`);
        }
    } catch (e) {
        console.error(`Error measuring element ${i}:`, e.message);
        errorCount++;
    }
}

const totalTime = Date.now() - startTime;
const avgTime = results.reduce((a, b) => a + b, 0) / results.length;

console.log('\n=== PERFORMANCE TEST RESULTS ===');
console.log(`Total elements: 100`);
console.log(`Successfully measured: ${successCount}`);
console.log(`Errors: ${errorCount}`);
console.log(`Total time: ${totalTime}ms`);
console.log(`Average time per element: ${avgTime.toFixed(2)}ms`);
console.log(`Min time: ${Math.min(...results)}ms`);
console.log(`Max time: ${Math.max(...results)}ms`);