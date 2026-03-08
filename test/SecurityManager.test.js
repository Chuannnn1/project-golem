const assert = require('assert');
const SecurityManager = require('../src/managers/SecurityManager');

function runTests() {
    console.log('🧪 Starting SecurityManager Tests...\n');
    let passed = 0;
    let failed = 0;

    const manager = new SecurityManager();

    // Helper function for running tests
    const test = (name, testFn) => {
        try {
            testFn();
            console.log(`✅ ${name}`);
            passed++;
        } catch (err) {
            console.error(`❌ ${name}`);
            console.error(`   ${err.message}`);
            failed++;
        }
    };

    // 1. Built-in safe commands
    test('Should allow built-in safe commands', () => {
        const result = manager.assess('ls -al');
        assert.strictEqual(result.level, 'SAFE', 'ls should be safe');
        assert.strictEqual(manager.assess('pwd').level, 'SAFE', 'pwd should be safe');
    });

    // 2. Dangerous commands
    test('Should block destructive commands', () => {
        const result = manager.assess('rm -rf /');
        assert.strictEqual(result.level, 'BLOCKED', 'rm -rf / should be blocked');
    });

    test('Should warn on high risk operations', () => {
        const result = manager.assess('sudo rm my_file.txt');
        assert.strictEqual(result.level, 'DANGER', 'sudo should be flagged as DANGER');
    });

    // 3. Unauthorized commands (not in whitelist)
    test('Should warn on unknown commands (Require Approval)', () => {
        const result = manager.assess('curl http://google.com');
        assert.strictEqual(result.level, 'WARNING', 'curl should require WARNING approval');
    });

    // 4. Custom Whitelist Evaluation
    test('Should allow custom whitelisted commands', () => {
        process.env.COMMAND_WHITELIST = 'curl, docker';
        const result = manager.assess('curl -X GET http://api.example.com');
        assert.strictEqual(result.level, 'SAFE', 'Whitelisted curl should be SAFE');

        const result2 = manager.assess('docker ps');
        assert.strictEqual(result2.level, 'SAFE', 'Whitelisted docker should be SAFE');

        // Clean up
        process.env.COMMAND_WHITELIST = '';
    });

    // 5. Commands with pipelines/redirections
    test('Should warn heavily on pipelines even if command is whitelisted', () => {
        process.env.COMMAND_WHITELIST = 'ls';
        const result = manager.assess('ls -la | grep auth');
        assert.strictEqual(result.level, 'WARNING', 'Piped whitelisted command should trigger WARNING');

        const subShellResult = manager.assess('echo $(whoami)');
        assert.strictEqual(subShellResult.level, 'WARNING', 'Subshell execution should trigger WARNING');

        // Clean up
        process.env.COMMAND_WHITELIST = '';
    });

    console.log(`\n=======================`);
    console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
}

runTests();
