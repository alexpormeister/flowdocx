// BPMN Template definitions - Feature-specific templates
export const BPMN_TEMPLATES = {
  basic_starter: {
    id: "basic_starter",
    name: "Basic BPMN Starter",
    description: "A simple blank template with a single pool and start event to begin any process mapping.",
    category: "Basic",
    systemTags: [],
    processSteps: [],
    bpmnXml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="basic-starter-diagram"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:collaboration id="Collaboration_1">
    <bpmn2:participant id="Participant_1" name="Process" processRef="Process_1" />
  </bpmn2:collaboration>
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="StartEvent_1" name="Start" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="600" height="250" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="222" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`,
  },

  sipoc_starter: {
    id: "sipoc_starter",
    name: "Strategic SIPOC Starter",
    description: "A template focused on mapping Suppliers, Inputs, Process, Outputs, and Customers before drawing the detailed flow.",
    category: "Strategic",
    systemTags: [],
    processSteps: [
      { step: 1, task: "Identify Suppliers", performer: "Process Owner", system: [], decision: "" },
      { step: 2, task: "Define Inputs", performer: "Process Owner", system: [], decision: "" },
      { step: 3, task: "Map High-Level Process", performer: "Team", system: [], decision: "" },
      { step: 4, task: "Document Outputs", performer: "Process Owner", system: [], decision: "" },
      { step: 5, task: "Identify Customers", performer: "Process Owner", system: [], decision: "" },
    ],
    bpmnXml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="sipoc-starter-diagram"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:collaboration id="Collaboration_SIPOC">
    <bpmn2:participant id="Lane_Supplier" name="Suppliers" processRef="Process_Supplier" />
    <bpmn2:participant id="Lane_Process" name="Core Process" processRef="Process_Core" />
    <bpmn2:participant id="Lane_Customer" name="Customers" processRef="Process_Customer" />
    <bpmn2:messageFlow id="Flow_Input" sourceRef="Task_Provide" targetRef="Task_Receive" />
    <bpmn2:messageFlow id="Flow_Output" sourceRef="Task_Deliver" targetRef="Task_Consume" />
  </bpmn2:collaboration>
  <bpmn2:process id="Process_Supplier" isExecutable="false">
    <bpmn2:startEvent id="Start_S" name="Input Ready" />
    <bpmn2:task id="Task_Provide" name="Provide Inputs" />
    <bpmn2:sequenceFlow id="sf1" sourceRef="Start_S" targetRef="Task_Provide" />
  </bpmn2:process>
  <bpmn2:process id="Process_Core" isExecutable="false">
    <bpmn2:task id="Task_Receive" name="Receive Inputs" />
    <bpmn2:task id="Task_Transform" name="Transform (Process)" />
    <bpmn2:task id="Task_Deliver" name="Deliver Outputs" />
    <bpmn2:sequenceFlow id="sf2" sourceRef="Task_Receive" targetRef="Task_Transform" />
    <bpmn2:sequenceFlow id="sf3" sourceRef="Task_Transform" targetRef="Task_Deliver" />
  </bpmn2:process>
  <bpmn2:process id="Process_Customer" isExecutable="false">
    <bpmn2:task id="Task_Consume" name="Receive Outputs" />
    <bpmn2:endEvent id="End_C" name="Value Delivered" />
    <bpmn2:sequenceFlow id="sf4" sourceRef="Task_Consume" targetRef="End_C" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_SIPOC">
    <bpmndi:BPMNPlane id="BPMNPlane_SIPOC" bpmnElement="Collaboration_SIPOC">
      <bpmndi:BPMNShape id="Lane_Supplier_di" bpmnElement="Lane_Supplier" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="700" height="120" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Process_di" bpmnElement="Lane_Process" isHorizontal="true">
        <dc:Bounds x="160" y="200" width="700" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Customer_di" bpmnElement="Lane_Customer" isHorizontal="true">
        <dc:Bounds x="160" y="350" width="700" height="120" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Start_S_di" bpmnElement="Start_S">
        <dc:Bounds x="212" y="122" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Provide_di" bpmnElement="Task_Provide">
        <dc:Bounds x="300" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Receive_di" bpmnElement="Task_Receive">
        <dc:Bounds x="300" y="235" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Transform_di" bpmnElement="Task_Transform">
        <dc:Bounds x="450" y="235" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Deliver_di" bpmnElement="Task_Deliver">
        <dc:Bounds x="600" y="235" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Consume_di" bpmnElement="Task_Consume">
        <dc:Bounds x="600" y="370" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_C_di" bpmnElement="End_C">
        <dc:Bounds x="752" y="392" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`,
  },

  system_optimization: {
    id: "system_optimization",
    name: "System Optimization Flow",
    description: "A BPMN template pre-configured with System Tags to demonstrate the Heatmap feature and identify tool-switching areas.",
    category: "IT Optimization",
    systemTags: ["iCabbi", "Outlook", "SAP", "Jira", "Slack"],
    processSteps: [
      { step: 1, task: "Receive Request", performer: "Agent", system: ["iCabbi"], decision: "" },
      { step: 2, task: "Log Ticket", performer: "Agent", system: ["Jira"], decision: "" },
      { step: 3, task: "Check Inventory", performer: "System", system: ["SAP"], decision: "Available?" },
      { step: 4, task: "Notify Team", performer: "Agent", system: ["Slack", "Outlook"], decision: "" },
      { step: 5, task: "Process Order", performer: "System", system: ["SAP", "iCabbi"], decision: "" },
      { step: 6, task: "Send Confirmation", performer: "Agent", system: ["Outlook"], decision: "" },
      { step: 7, task: "Close Ticket", performer: "Agent", system: ["Jira"], decision: "" },
    ],
    bpmnXml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="system-optimization-diagram"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:collaboration id="Collaboration_SysOpt">
    <bpmn2:participant id="Lane_Agent" name="Agent" processRef="Process_Agent" />
    <bpmn2:participant id="Lane_System" name="System" processRef="Process_System" />
  </bpmn2:collaboration>
  <bpmn2:process id="Process_Agent" isExecutable="false">
    <bpmn2:startEvent id="Start_Opt" name="Request Received" />
    <bpmn2:task id="Task_Receive" name="Receive Request (iCabbi)" />
    <bpmn2:task id="Task_Log" name="Log Ticket (Jira)" />
    <bpmn2:task id="Task_Notify" name="Notify Team (Slack/Outlook)" />
    <bpmn2:task id="Task_Confirm" name="Send Confirmation (Outlook)" />
    <bpmn2:task id="Task_Close" name="Close Ticket (Jira)" />
    <bpmn2:endEvent id="End_Opt" name="Complete" />
    <bpmn2:sequenceFlow id="sf1" sourceRef="Start_Opt" targetRef="Task_Receive" />
    <bpmn2:sequenceFlow id="sf2" sourceRef="Task_Receive" targetRef="Task_Log" />
    <bpmn2:sequenceFlow id="sf6" sourceRef="Task_Confirm" targetRef="Task_Close" />
    <bpmn2:sequenceFlow id="sf7" sourceRef="Task_Close" targetRef="End_Opt" />
  </bpmn2:process>
  <bpmn2:process id="Process_System" isExecutable="false">
    <bpmn2:task id="Task_Check" name="Check Inventory (SAP)" />
    <bpmn2:exclusiveGateway id="Gateway_Available" name="Available?" />
    <bpmn2:task id="Task_Process" name="Process Order (SAP/iCabbi)" />
    <bpmn2:sequenceFlow id="sf3" sourceRef="Task_Log" targetRef="Task_Check" />
    <bpmn2:sequenceFlow id="sf4" sourceRef="Task_Check" targetRef="Gateway_Available" />
    <bpmn2:sequenceFlow id="sf5" name="Yes" sourceRef="Gateway_Available" targetRef="Task_Notify" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_SysOpt">
    <bpmndi:BPMNPlane id="BPMNPlane_SysOpt" bpmnElement="Collaboration_SysOpt">
      <bpmndi:BPMNShape id="Lane_Agent_di" bpmnElement="Lane_Agent" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="900" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_System_di" bpmnElement="Lane_System" isHorizontal="true">
        <dc:Bounds x="160" y="230" width="900" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Start_Opt_di" bpmnElement="Start_Opt">
        <dc:Bounds x="212" y="137" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Receive_di" bpmnElement="Task_Receive">
        <dc:Bounds x="280" y="115" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Log_di" bpmnElement="Task_Log">
        <dc:Bounds x="410" y="115" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Check_di" bpmnElement="Task_Check">
        <dc:Bounds x="410" y="265" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Available_di" bpmnElement="Gateway_Available" isMarkerVisible="true">
        <dc:Bounds x="545" y="280" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Notify_di" bpmnElement="Task_Notify">
        <dc:Bounds x="630" y="115" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Process_di" bpmnElement="Task_Process">
        <dc:Bounds x="630" y="265" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Confirm_di" bpmnElement="Task_Confirm">
        <dc:Bounds x="770" y="115" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Close_di" bpmnElement="Task_Close">
        <dc:Bounds x="900" y="115" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Opt_di" bpmnElement="End_Opt">
        <dc:Bounds x="1032" y="137" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`,
  },

  compliance_doc: {
    id: "compliance_doc",
    name: "Compliance & Documentation",
    description: "A layout optimized for the Auto-Documentation (SOP) generator with clear step descriptions and decision points.",
    category: "Compliance",
    systemTags: ["Document Management", "Email"],
    processSteps: [
      { step: 1, task: "Initiate Request", performer: "Requester", system: ["Email"], decision: "" },
      { step: 2, task: "Review Compliance Requirements", performer: "Compliance Officer", system: ["Document Management"], decision: "Compliant?" },
      { step: 3, task: "Request Additional Info", performer: "Compliance Officer", system: ["Email"], decision: "" },
      { step: 4, task: "Approve Request", performer: "Manager", system: ["Document Management"], decision: "Approved?" },
      { step: 5, task: "Document Decision", performer: "Compliance Officer", system: ["Document Management"], decision: "" },
      { step: 6, task: "Archive Records", performer: "System", system: ["Document Management"], decision: "" },
      { step: 7, task: "Notify Stakeholders", performer: "System", system: ["Email"], decision: "" },
    ],
    bpmnXml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="compliance-doc-diagram"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:collaboration id="Collaboration_Compliance">
    <bpmn2:participant id="Lane_Requester" name="Requester" processRef="Process_Requester" />
    <bpmn2:participant id="Lane_Compliance" name="Compliance Officer" processRef="Process_Compliance" />
    <bpmn2:participant id="Lane_Manager" name="Manager" processRef="Process_Manager" />
  </bpmn2:collaboration>
  <bpmn2:process id="Process_Requester" isExecutable="false">
    <bpmn2:startEvent id="Start_Comp" name="Request Initiated" />
    <bpmn2:task id="Task_Initiate" name="Initiate Request" />
    <bpmn2:endEvent id="End_Notified" name="Notified" />
    <bpmn2:sequenceFlow id="sf1" sourceRef="Start_Comp" targetRef="Task_Initiate" />
  </bpmn2:process>
  <bpmn2:process id="Process_Compliance" isExecutable="false">
    <bpmn2:task id="Task_Review" name="Review Compliance Requirements" />
    <bpmn2:exclusiveGateway id="Gateway_Compliant" name="Compliant?" />
    <bpmn2:task id="Task_RequestInfo" name="Request Additional Info" />
    <bpmn2:task id="Task_Document" name="Document Decision" />
    <bpmn2:task id="Task_Archive" name="Archive Records" />
    <bpmn2:task id="Task_Notify" name="Notify Stakeholders" />
    <bpmn2:endEvent id="End_Comp" name="Process Complete" />
    <bpmn2:sequenceFlow id="sf2" sourceRef="Task_Initiate" targetRef="Task_Review" />
    <bpmn2:sequenceFlow id="sf3" sourceRef="Task_Review" targetRef="Gateway_Compliant" />
    <bpmn2:sequenceFlow id="sf4" name="No" sourceRef="Gateway_Compliant" targetRef="Task_RequestInfo" />
    <bpmn2:sequenceFlow id="sf5" name="Yes" sourceRef="Gateway_Compliant" targetRef="Task_Approve" />
    <bpmn2:sequenceFlow id="sf8" sourceRef="Task_Document" targetRef="Task_Archive" />
    <bpmn2:sequenceFlow id="sf9" sourceRef="Task_Archive" targetRef="Task_Notify" />
    <bpmn2:sequenceFlow id="sf10" sourceRef="Task_Notify" targetRef="End_Comp" />
  </bpmn2:process>
  <bpmn2:process id="Process_Manager" isExecutable="false">
    <bpmn2:task id="Task_Approve" name="Approve Request" />
    <bpmn2:exclusiveGateway id="Gateway_Approved" name="Approved?" />
    <bpmn2:sequenceFlow id="sf6" sourceRef="Task_Approve" targetRef="Gateway_Approved" />
    <bpmn2:sequenceFlow id="sf7" name="Yes" sourceRef="Gateway_Approved" targetRef="Task_Document" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_Compliance">
    <bpmndi:BPMNPlane id="BPMNPlane_Compliance" bpmnElement="Collaboration_Compliance">
      <bpmndi:BPMNShape id="Lane_Requester_di" bpmnElement="Lane_Requester" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="900" height="100" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Compliance_di" bpmnElement="Lane_Compliance" isHorizontal="true">
        <dc:Bounds x="160" y="180" width="900" height="180" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Manager_di" bpmnElement="Lane_Manager" isHorizontal="true">
        <dc:Bounds x="160" y="360" width="900" height="120" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Start_Comp_di" bpmnElement="Start_Comp">
        <dc:Bounds x="212" y="112" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Initiate_di" bpmnElement="Task_Initiate">
        <dc:Bounds x="280" y="90" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Review_di" bpmnElement="Task_Review">
        <dc:Bounds x="280" y="230" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Compliant_di" bpmnElement="Gateway_Compliant" isMarkerVisible="true">
        <dc:Bounds x="415" y="245" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_RequestInfo_di" bpmnElement="Task_RequestInfo">
        <dc:Bounds x="500" y="190" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Approve_di" bpmnElement="Task_Approve">
        <dc:Bounds x="500" y="380" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Approved_di" bpmnElement="Gateway_Approved" isMarkerVisible="true">
        <dc:Bounds x="635" y="395" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Document_di" bpmnElement="Task_Document">
        <dc:Bounds x="720" y="230" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Archive_di" bpmnElement="Task_Archive">
        <dc:Bounds x="850" y="230" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Notify_di" bpmnElement="Task_Notify">
        <dc:Bounds x="980" y="230" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Comp_di" bpmnElement="End_Comp">
        <dc:Bounds x="1012" y="322" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Notified_di" bpmnElement="End_Notified">
        <dc:Bounds x="1012" y="112" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`,
  },
};

export type TemplateId = keyof typeof BPMN_TEMPLATES;
export type Template = typeof BPMN_TEMPLATES[TemplateId];
