// Memory leak test script
const iterations = 100;
const batchSize = 10;
let completedOps = 0;

console.log('Starting memory leak test...');
console.log(`Will perform ${iterations} measurements in batches of ${batchSize}`);

async function measureBatch(startIdx) {
    const promises = [];
    
    for (let i = 0; i < batchSize; i++) {
        const idx = (startIdx + i) % 10 + 1;
        const selector = idx <= 5 ? `#static-${idx}` : `#dynamic-${idx - 5}`;
        
        // Simulate measurement
        promises.push(new Promise((resolve) => {
            setTimeout(() => {
                completedOps++;
                resolve({ selector, time: Date.now() });
            }, Math.random() * 50 + 20);
        }));
    }
    
    await Promise.all(promises);
}

async function runTest() {
    const startTime = Date.now();
    const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    for (let i = 0; i < iterations; i += batchSize) {
        await measureBatch(i);
        
        if ((i + batchSize) % 50 === 0) {
            const currentMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
            const memoryDelta = ((currentMemory - startMemory) / 1024 / 1024).toFixed(2);
            console.log(`Progress: ${i + batchSize}/${iterations} operations, Memory delta: ${memoryDelta}MB`);
        }
    }
    
    const endTime = Date.now();
    const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    console.log('\n=== Memory Leak Test Results ===');
    console.log(`Total operations: ${completedOps}`);
    console.log(`Total time: ${endTime - startTime}ms`);
    console.log(`Starting memory: ${(startMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Ending memory: ${(endMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Memory increase: ${((endMemory - startMemory) / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Average memory per op: ${((endMemory - startMemory) / completedOps / 1024).toFixed(2)}KB`);
}

// Note: This is a simulation. In actual testing, replace the setTimeout
// with real babayaga-qe tool calls like:
// await mcp__babayaga_qe__qa_measure_element({ selector })

runTest().catch(console.error);