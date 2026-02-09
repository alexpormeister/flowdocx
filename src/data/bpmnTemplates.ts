// BPMN Template definitions
export const BPMN_TEMPLATES = {
  standard_service: {
    id: "standard_service",
    name: "Standard Service Process",
    description: "A pre-filled 3-lane horizontal layout (Customer, Agent, System) for basic feedback or order flows.",
    category: "Service",
    systemTags: ["iCabbi", "Outlook"],
    processSteps: [
      { step: 1, task: "Submit Request", performer: "Customer", system: [], decision: "" },
      { step: 2, task: "Receive & Review", performer: "Agent", system: ["iCabbi"], decision: "" },
      { step: 3, task: "Process Request", performer: "System", system: ["iCabbi"], decision: "" },
      { step: 4, task: "Send Confirmation", performer: "Agent", system: ["Outlook"], decision: "" },
      { step: 5, task: "Receive Response", performer: "Customer", system: [], decision: "" },
    ],
    bpmnXml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="standard-service-diagram"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:collaboration id="Collaboration_Service">
    <bpmn2:participant id="Lane_Customer" name="Customer" processRef="Process_Customer" />
    <bpmn2:participant id="Lane_Agent" name="Agent" processRef="Process_Agent" />
    <bpmn2:participant id="Lane_System" name="System" processRef="Process_System" />
    <bpmn2:messageFlow id="Flow_1" sourceRef="Task_Submit" targetRef="Task_Receive" />
    <bpmn2:messageFlow id="Flow_2" sourceRef="Task_Send" targetRef="Task_Response" />
  </bpmn2:collaboration>
  <bpmn2:process id="Process_Customer" isExecutable="false">
    <bpmn2:startEvent id="Start_Customer" name="Start" />
    <bpmn2:task id="Task_Submit" name="Submit Request" />
    <bpmn2:task id="Task_Response" name="Receive Response" />
    <bpmn2:endEvent id="End_Customer" name="End" />
    <bpmn2:sequenceFlow id="sf1" sourceRef="Start_Customer" targetRef="Task_Submit" />
    <bpmn2:sequenceFlow id="sf2" sourceRef="Task_Response" targetRef="End_Customer" />
  </bpmn2:process>
  <bpmn2:process id="Process_Agent" isExecutable="false">
    <bpmn2:task id="Task_Receive" name="Receive &amp; Review" />
    <bpmn2:task id="Task_Send" name="Send Confirmation" />
    <bpmn2:sequenceFlow id="sf3" sourceRef="Task_Receive" targetRef="Task_Process" />
    <bpmn2:sequenceFlow id="sf5" sourceRef="Task_Process" targetRef="Task_Send" />
  </bpmn2:process>
  <bpmn2:process id="Process_System" isExecutable="false">
    <bpmn2:task id="Task_Process" name="Process Request" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_Service">
      <bpmndi:BPMNShape id="Lane_Customer_di" bpmnElement="Lane_Customer" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="700" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Agent_di" bpmnElement="Lane_Agent" isHorizontal="true">
        <dc:Bounds x="160" y="230" width="700" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_System_di" bpmnElement="Lane_System" isHorizontal="true">
        <dc:Bounds x="160" y="380" width="700" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Start_Customer_di" bpmnElement="Start_Customer">
        <dc:Bounds x="212" y="137" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Submit_di" bpmnElement="Task_Submit">
        <dc:Bounds x="290" y="115" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Response_di" bpmnElement="Task_Response">
        <dc:Bounds x="610" y="115" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Customer_di" bpmnElement="End_Customer">
        <dc:Bounds x="762" y="137" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Receive_di" bpmnElement="Task_Receive">
        <dc:Bounds x="290" y="265" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Send_di" bpmnElement="Task_Send">
        <dc:Bounds x="610" y="265" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Process_di" bpmnElement="Task_Process">
        <dc:Bounds x="450" y="415" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`,
  },

  investigation_qc: {
    id: "investigation_qc",
    name: "Investigation & Quality Control",
    description: "A specialized layout focusing on decision gateways for investigating 'Asiattomuudet' or 'Kurinpidolliset toimenpiteet'.",
    category: "Quality Control",
    systemTags: ["iCabbi", "Outlook", "Jira"],
    processSteps: [
      { step: 1, task: "Report Incident", performer: "Reporter", system: ["iCabbi"], decision: "" },
      { step: 2, task: "Initial Review", performer: "Quality Control", system: ["Jira"], decision: "Valid?" },
      { step: 3, task: "Investigate Case", performer: "Quality Control", system: ["iCabbi", "Jira"], decision: "" },
      { step: 4, task: "Decision: Severity", performer: "Quality Control", system: [], decision: "Mild/Severe?" },
      { step: 5, task: "Issue Warning", performer: "Quality Control", system: ["Outlook"], decision: "" },
      { step: 6, task: "Escalate to Management", performer: "Management", system: ["Outlook"], decision: "" },
      { step: 7, task: "Close Case", performer: "Quality Control", system: ["Jira"], decision: "" },
    ],
    bpmnXml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="investigation-qc-diagram"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:collaboration id="Collaboration_QC">
    <bpmn2:participant id="Lane_Reporter" name="Reporter" processRef="Process_Reporter" />
    <bpmn2:participant id="Lane_QC" name="Quality Control" processRef="Process_QC" />
    <bpmn2:participant id="Lane_Mgmt" name="Management" processRef="Process_Mgmt" />
  </bpmn2:collaboration>
  <bpmn2:process id="Process_Reporter" isExecutable="false">
    <bpmn2:startEvent id="Start_QC" name="Incident Reported" />
    <bpmn2:task id="Task_Report" name="Report Incident" />
    <bpmn2:sequenceFlow id="sf1" sourceRef="Start_QC" targetRef="Task_Report" />
  </bpmn2:process>
  <bpmn2:process id="Process_QC" isExecutable="false">
    <bpmn2:task id="Task_Review" name="Initial Review" />
    <bpmn2:exclusiveGateway id="Gateway_Valid" name="Valid?" />
    <bpmn2:task id="Task_Investigate" name="Investigate Case" />
    <bpmn2:exclusiveGateway id="Gateway_Severity" name="Severity?" />
    <bpmn2:task id="Task_Warning" name="Issue Warning" />
    <bpmn2:task id="Task_Close" name="Close Case" />
    <bpmn2:endEvent id="End_QC" name="Case Closed" />
    <bpmn2:sequenceFlow id="sf2" sourceRef="Task_Review" targetRef="Gateway_Valid" />
    <bpmn2:sequenceFlow id="sf3" name="Yes" sourceRef="Gateway_Valid" targetRef="Task_Investigate" />
    <bpmn2:sequenceFlow id="sf4" sourceRef="Task_Investigate" targetRef="Gateway_Severity" />
    <bpmn2:sequenceFlow id="sf5" name="Mild" sourceRef="Gateway_Severity" targetRef="Task_Warning" />
    <bpmn2:sequenceFlow id="sf7" sourceRef="Task_Warning" targetRef="Task_Close" />
    <bpmn2:sequenceFlow id="sf8" sourceRef="Task_Close" targetRef="End_QC" />
    <bpmn2:sequenceFlow id="sf9" name="No" sourceRef="Gateway_Valid" targetRef="Task_Close" />
  </bpmn2:process>
  <bpmn2:process id="Process_Mgmt" isExecutable="false">
    <bpmn2:task id="Task_Escalate" name="Escalate to Management" />
    <bpmn2:sequenceFlow id="sf6" name="Severe" sourceRef="Gateway_Severity" targetRef="Task_Escalate" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_2">
    <bpmndi:BPMNPlane id="BPMNPlane_2" bpmnElement="Collaboration_QC">
      <bpmndi:BPMNShape id="Lane_Reporter_di" bpmnElement="Lane_Reporter" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="800" height="120" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_QC_di" bpmnElement="Lane_QC" isHorizontal="true">
        <dc:Bounds x="160" y="200" width="800" height="200" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Mgmt_di" bpmnElement="Lane_Mgmt" isHorizontal="true">
        <dc:Bounds x="160" y="400" width="800" height="120" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Start_QC_di" bpmnElement="Start_QC">
        <dc:Bounds x="212" y="122" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Report_di" bpmnElement="Task_Report">
        <dc:Bounds x="290" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Review_di" bpmnElement="Task_Review">
        <dc:Bounds x="290" y="260" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Valid_di" bpmnElement="Gateway_Valid" isMarkerVisible="true">
        <dc:Bounds x="425" y="275" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Investigate_di" bpmnElement="Task_Investigate">
        <dc:Bounds x="510" y="260" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Severity_di" bpmnElement="Gateway_Severity" isMarkerVisible="true">
        <dc:Bounds x="645" y="275" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Warning_di" bpmnElement="Task_Warning">
        <dc:Bounds x="730" y="220" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Close_di" bpmnElement="Task_Close">
        <dc:Bounds x="860" y="260" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_QC_di" bpmnElement="End_QC">
        <dc:Bounds x="892" y="352" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Escalate_di" bpmnElement="Task_Escalate">
        <dc:Bounds x="730" y="420" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`,
  },

  financial_approval: {
    id: "financial_approval",
    name: "Financial Approval Workflow",
    description: "A complex multi-step template for invoice handling and payroll, including roles like 'Esimies' and 'Taloushallinto'.",
    category: "Finance",
    systemTags: ["Netvisor", "Outlook", "SAP"],
    processSteps: [
      { step: 1, task: "Submit Invoice/Request", performer: "Employee", system: ["Netvisor"], decision: "" },
      { step: 2, task: "Initial Verification", performer: "Taloushallinto", system: ["Netvisor"], decision: "Complete?" },
      { step: 3, task: "Review & Approve", performer: "Esimies", system: ["Netvisor", "Outlook"], decision: "Approved?" },
      { step: 4, task: "Final Processing", performer: "Taloushallinto", system: ["Netvisor", "SAP"], decision: "" },
      { step: 5, task: "Payment Execution", performer: "Taloushallinto", system: ["SAP"], decision: "" },
      { step: 6, task: "Return for Corrections", performer: "Employee", system: ["Outlook"], decision: "" },
      { step: 7, task: "Archive & Close", performer: "Taloushallinto", system: ["Netvisor"], decision: "" },
    ],
    bpmnXml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="financial-approval-diagram"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:collaboration id="Collaboration_Finance">
    <bpmn2:participant id="Lane_Employee" name="Employee" processRef="Process_Employee" />
    <bpmn2:participant id="Lane_Esimies" name="Esimies" processRef="Process_Esimies" />
    <bpmn2:participant id="Lane_Talous" name="Taloushallinto" processRef="Process_Talous" />
  </bpmn2:collaboration>
  <bpmn2:process id="Process_Employee" isExecutable="false">
    <bpmn2:startEvent id="Start_Fin" name="Request Started" />
    <bpmn2:task id="Task_Submit" name="Submit Invoice/Request" />
    <bpmn2:task id="Task_Corrections" name="Make Corrections" />
    <bpmn2:sequenceFlow id="sf1" sourceRef="Start_Fin" targetRef="Task_Submit" />
  </bpmn2:process>
  <bpmn2:process id="Process_Esimies" isExecutable="false">
    <bpmn2:task id="Task_Approve" name="Review &amp; Approve" />
    <bpmn2:exclusiveGateway id="Gateway_Approved" name="Approved?" />
    <bpmn2:sequenceFlow id="sf4" sourceRef="Task_Approve" targetRef="Gateway_Approved" />
  </bpmn2:process>
  <bpmn2:process id="Process_Talous" isExecutable="false">
    <bpmn2:task id="Task_Verify" name="Initial Verification" />
    <bpmn2:exclusiveGateway id="Gateway_Complete" name="Complete?" />
    <bpmn2:task id="Task_Process" name="Final Processing" />
    <bpmn2:task id="Task_Payment" name="Payment Execution" />
    <bpmn2:task id="Task_Archive" name="Archive &amp; Close" />
    <bpmn2:endEvent id="End_Fin" name="Completed" />
    <bpmn2:sequenceFlow id="sf2" sourceRef="Task_Verify" targetRef="Gateway_Complete" />
    <bpmn2:sequenceFlow id="sf3" name="Yes" sourceRef="Gateway_Complete" targetRef="Task_Approve" />
    <bpmn2:sequenceFlow id="sf5" name="Yes" sourceRef="Gateway_Approved" targetRef="Task_Process" />
    <bpmn2:sequenceFlow id="sf6" sourceRef="Task_Process" targetRef="Task_Payment" />
    <bpmn2:sequenceFlow id="sf7" sourceRef="Task_Payment" targetRef="Task_Archive" />
    <bpmn2:sequenceFlow id="sf8" sourceRef="Task_Archive" targetRef="End_Fin" />
    <bpmn2:sequenceFlow id="sf9" name="No" sourceRef="Gateway_Complete" targetRef="Task_Corrections" />
    <bpmn2:sequenceFlow id="sf10" name="No" sourceRef="Gateway_Approved" targetRef="Task_Corrections" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_3">
    <bpmndi:BPMNPlane id="BPMNPlane_3" bpmnElement="Collaboration_Finance">
      <bpmndi:BPMNShape id="Lane_Employee_di" bpmnElement="Lane_Employee" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="900" height="130" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Esimies_di" bpmnElement="Lane_Esimies" isHorizontal="true">
        <dc:Bounds x="160" y="210" width="900" height="130" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Talous_di" bpmnElement="Lane_Talous" isHorizontal="true">
        <dc:Bounds x="160" y="340" width="900" height="160" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Start_Fin_di" bpmnElement="Start_Fin">
        <dc:Bounds x="212" y="127" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Submit_di" bpmnElement="Task_Submit">
        <dc:Bounds x="290" y="105" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Corrections_di" bpmnElement="Task_Corrections">
        <dc:Bounds x="850" y="105" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Approve_di" bpmnElement="Task_Approve">
        <dc:Bounds x="530" y="235" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Approved_di" bpmnElement="Gateway_Approved" isMarkerVisible="true">
        <dc:Bounds x="665" y="250" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Verify_di" bpmnElement="Task_Verify">
        <dc:Bounds x="290" y="380" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Complete_di" bpmnElement="Gateway_Complete" isMarkerVisible="true">
        <dc:Bounds x="425" y="395" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Process_di" bpmnElement="Task_Process">
        <dc:Bounds x="530" y="380" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Payment_di" bpmnElement="Task_Payment">
        <dc:Bounds x="660" y="380" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Archive_di" bpmnElement="Task_Archive">
        <dc:Bounds x="790" y="380" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Fin_di" bpmnElement="End_Fin">
        <dc:Bounds x="922" y="402" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`,
  },
};

export type TemplateId = keyof typeof BPMN_TEMPLATES;
export type Template = typeof BPMN_TEMPLATES[TemplateId];
