// Performance test script
async function runPerformanceTest() {
    const start = Date.now();
    const results = [];
    
    // Test 1: Sequential measurements
    console.log('Starting sequential measurement test...');
    const seqStart = Date.now();
    
    for (let i = 1; i <= 8; i++) {
        const measureStart = Date.now();
        try {
            await window.qa_measure_element({ selector: `[data-index="${i}"]` });
            results.push(Date.now() - measureStart);
        } catch (e) {
            console.error(`Failed to measure item ${i}:`, e);
        }
    }
    
    const seqEnd = Date.now();
    const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
    
    console.log(`Sequential test completed in ${seqEnd - seqStart}ms`);
    console.log(`Average time per measurement: ${avgTime.toFixed(2)}ms`);
    console.log(`Individual times:`, results);
    
    // Test 2: Concurrent measurements
    console.log('\nStarting concurrent measurement test...');
    const concStart = Date.now();
    
    const promises = [];
    for (let i = 1; i <= 8; i++) {
        promises.push(window.qa_measure_element({ selector: `[data-index="${i}"]` }));
    }
    
    await Promise.all(promises);
    const concEnd = Date.now();
    
    console.log(`Concurrent test completed in ${concEnd - concStart}ms`);
    console.log(`Time saved: ${(seqEnd - seqStart) - (concEnd - concStart)}ms`);
    
    return {
        sequential: {
            total: seqEnd - seqStart,
            average: avgTime,
            measurements: results
        },
        concurrent: {
            total: concEnd - concStart
        }
    };
}

// Run the test
runPerformanceTest().then(results => {
    console.log('\nFinal results:', results);
});