# Babayaga Honeypot Demo Usage

This document demonstrates how to use the Babayaga Honeypot system for checklist-driven agent testing.

## Overview

The Babayaga Honeypot provides a trust layer for agent-driven testing by:
- Ensuring agents follow structured test checklists
- Collecting verifiable evidence of all agent actions
- Detecting suspicious behavior or deception attempts
- Generating comprehensive audit reports

## MCP Tools Available

### 1. `initialize_agent_checklist`
Initialize a new testing session for an agent.

**Parameters:**
- `agentId`: Unique identifier for the agent
- `checklistPath`: Path to the JSON checklist file

**Example:**
```json
{
  "agentId": "test-agent-001", 
  "checklistPath": "/path/to/checklist.json"
}
```

### 2. `get_next_test`
Get the next test item for the agent to execute.

**Parameters:**
- `agentId`: Agent identifier

**Returns:**
Detailed test instructions including:
- Test description and requirements
- Expected outcomes
- Verification criteria
- Evidence requirements

### 3. `log_test_action`
Log an action the agent is taking during test execution.

**Parameters:**
- `agentId`: Agent identifier
- `itemId`: Test item ID
- `action`: Description of action being taken
- `context`: Additional context data (optional)

### 4. `record_tool_call`
Record a tool call made by the agent with timing and results.

**Parameters:**
- `agentId`: Agent identifier
- `itemId`: Test item ID
- `toolName`: Name of the tool that was called
- `parameters`: Parameters passed to the tool
- `response`: Response received from the tool
- `duration`: Duration of the tool call in milliseconds
- `success`: Whether the tool call was successful

### 5. `complete_test_item`
Mark a test item as completed with results and evidence.

**Parameters:**
- `agentId`: Agent identifier
- `itemId`: Test item ID
- `passed`: Whether the test passed
- `comments`: Agent comments about the test execution
- `additionalEvidence`: Additional evidence data (optional)

### 6. `skip_test_item`
Skip a test item with a reason.

**Parameters:**
- `agentId`: Agent identifier
- `itemId`: Test item ID
- `reason`: Reason for skipping the test

### 7. `get_checklist_status`
Get the current status of the checklist for an agent.

**Parameters:**
- `agentId`: Agent identifier

### 8. `get_checklist_report`
Generate a final comprehensive report of all checklist results.

**Parameters:**
- `agentId`: Agent identifier

## Example Workflow

Here's how an agent would typically use the honeypot system:

1. **Initialize the checklist:**
   ```
   initialize_agent_checklist(agentId="test-agent-001", checklistPath="./docs/example-checklist.json")
   ```

2. **Get the first test:**
   ```
   get_next_test(agentId="test-agent-001")
   ```

3. **Log actions and record tool calls:**
   ```
   log_test_action(agentId="test-agent-001", itemId="test_001", action="Starting element measurement test")
   
   # Agent uses babayaga-qe tools
   record_tool_call(
     agentId="test-agent-001",
     itemId="test_001", 
     toolName="qa_measure_element",
     parameters={"selector": "#my-button"},
     response={"width": 120, "height": 40, ...},
     duration=45,
     success=true
   )
   ```

4. **Complete the test:**
   ```
   complete_test_item(
     agentId="test-agent-001",
     itemId="test_001",
     passed=true,
     comments="Element measurement completed successfully with accurate results"
   )
   ```

5. **Continue with next tests:**
   ```
   get_next_test(agentId="test-agent-001")
   # Repeat process...
   ```

6. **Generate final report:**
   ```
   get_checklist_report(agentId="test-agent-001")
   ```

## Evidence Collection

The honeypot automatically collects:
- **Logs**: All agent actions and messages
- **Tool Calls**: Complete record of MCP tool usage with timing
- **Screenshots**: Visual evidence of test execution
- **Measurements**: Data from qa measurement tools
- **Network Requests**: HTTP traffic during testing
- **Error Messages**: Any failures or issues encountered

## Trust Verification

The system provides several trust mechanisms:
- **Timing Analysis**: Detects impossibly fast tool calls
- **Evidence Quality Scoring**: Evaluates completeness of evidence
- **Behavioral Monitoring**: Identifies suspicious patterns
- **Cross-validation**: Verifies claims against collected evidence

## Integration with Babayaga Ecosystem

The honeypot integrates with other Babayaga servers:
- **babayaga-qe**: Frontend testing and measurement tools
- **babayaga-performance**: Performance testing (future)
- **babayaga-api**: API testing (future)
- **babayaga-security**: Security testing (future)

## Configuration with Claude

Add the honeypot to your Claude MCP configuration:

```bash
claude mcp add babayaga-honeypot "npm start --workspace=babayaga-honeypot"
```

Then you can use honeypot tools alongside other Babayaga servers for comprehensive, verified testing workflows.