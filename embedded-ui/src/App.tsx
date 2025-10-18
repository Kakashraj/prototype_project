import React, { useState, useCallback, useEffect } from "react";
import ReactFlow, {
  Handle,
  Position,
  addEdge,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
} from "react-flow-renderer";
import type {
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  XYPosition,
} from "react-flow-renderer";
import "./App.css";

interface SidebarItem {
  type: "component" | "sensor";
  label: string;
  id: string;
}

const sidebarItems: SidebarItem[] = [
  { type: "component", label: "Arduino Uno", id: "arduinoUno" },
  { type: "component", label: "Arduino Nano", id: "arduinoNano" },
  { type: "component", label: "Raspberry Pi", id: "raspberryPi" },
  { type: "component", label: "ESP32", id: "esp32" },
  { type: "component", label: "Power Supply", id: "powerSupply" },
  { type: "component", label: "Ground", id: "ground" },
  { type: "sensor", label: "Temperature Sensor", id: "tempSensor" },
  { type: "sensor", label: "Light Sensor", id: "lightSensor" },
  { type: "sensor", label: "Humidity Sensor", id: "humiditySensor" },
  { type: "sensor", label: "Ultrasonic Sensor", id: "ultrasonicSensor" },
  { type: "sensor", label: "Push Button", id: "pushButton" },
  { type: "sensor", label: "LED", id: "led" },
];

let id = 0;
const getId = () => `node_${id++}`;

function App() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);

  // 🧹 Delete edge with keyboard
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedEdges.length > 0) {
        setEdges((eds) => eds.filter((e) => !selectedEdges.includes(e)));
        setSelectedEdges([]);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedEdges]);

  // 🎛 Node & edge changes
  const onNodesChange = (changes: NodeChange[]) =>
    setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange = (changes: EdgeChange[]) =>
    setEdges((eds) => applyEdgeChanges(changes, eds));
  const onConnect = (connection: Connection) =>
    setEdges((eds) => addEdge(connection, eds));

  const onNodesDelete = (deletedNodes: Node[]) => {
    const deletedIds = deletedNodes.map((n) => n.id);
    setNodes((nds) => nds.filter((n) => !deletedIds.includes(n.id)));
    setEdges((eds) =>
      eds.filter((e) => !deletedIds.includes(e.source) && !deletedIds.includes(e.target))
    );
  };

  const onEdgesDelete = (deletedEdges: Edge[]) => {
    setEdges((eds) => eds.filter((e) => !deletedEdges.includes(e)));
  };

  // ❌ Delete node manually
  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  // 🧩 Drop new nodes
  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const reactFlowBounds = (event.target as HTMLDivElement).getBoundingClientRect();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const position: XYPosition = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const nodeId = getId();

      const newNode: Node = {
        id: nodeId,
        type: "default",
        position,
        data: {
          type: sidebarItems.find((i) => i.label === type)?.type,
          label: type,
          value: type.includes("Sensor") ? 0 : false,
          condition: { operator: "", action: "" },
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setShowWelcome(false);
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // 🔢 Update sensor values (with limits)
  const updateSensorValue = (nodeId: string, value: number) => {
    const clampedValue = Math.max(0, Math.min(value, 1000));
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, value: clampedValue } } : n
      )
    );
  };

  // ⚙️ Update condition logic
  const updateCondition = (nodeId: string, field: string, value: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, condition: { ...n.data.condition, [field]: value } } }
          : n
      )
    );
  };

  // 🧠 Logic Evaluation
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          if (node.data.type === "sensor" && node.data.condition) {
            const { operator, action } = node.data.condition;
            const value = node.data.value;
            let trigger = false;

            switch (operator) {
              case ">":
                trigger = value > 100; // sample default logic
                break;
              case "<":
                trigger = value < 100;
                break;
              case "==":
                trigger = value === 100;
                break;
              default:
                trigger = false;
            }

            if (node.data.label === "LED") {
              return {
                ...node,
                data: { ...node.data, isOn: trigger && action === "ON" },
              };
            }
          }
          return node;
        })
      );
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // 📤 Export JSON
  // 📤 Export JSON with node values, conditions, and actions
const exportJSON = async () => {
  const nodeIdToLabel: Record<string, string> = {};
  nodes.forEach((node) => { nodeIdToLabel[node.id] = node.data.label; });

  const nodeData = nodes.map((node) => ({
    id: node.id,
    label: node.data.label,
    type: node.data.type,
    value: node.data.value ?? null,
    condition: node.data.condition ?? null,
  }));

  const connectionData = edges.map((edge) => ({
    from: nodeIdToLabel[edge.source] || edge.source,
    to: nodeIdToLabel[edge.target] || edge.target,
  }));

  const data = { nodes: nodeData, connections: connectionData };

  try {
    const response = await fetch("http://localhost:8000/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    console.log(result.message);

    // Optional: automatically download Arduino code
    const blob = new Blob([result.arduino_code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "generated_arduino.ino";
    link.click();
  } catch (error) {
    console.error("Error generating Arduino code:", error);
  }
};



  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <h3>Components</h3>
        {sidebarItems
          .filter((i) => i.type === "component")
          .map((item) => (
            <div
              key={item.id}
              className="sidebar-item"
              draggable
              onDragStart={(event) =>
                event.dataTransfer.setData("application/reactflow", item.label)
              }
            >
              {item.label}
            </div>
          ))}
        <h3>Sensors</h3>
        {sidebarItems
          .filter((i) => i.type === "sensor")
          .map((item) => (
            <div
              key={item.id}
              className="sidebar-item"
              draggable
              onDragStart={(event) =>
                event.dataTransfer.setData("application/reactflow", item.label)
              }
            >
              {item.label}
            </div>
          ))}
      </div>

      {/* Canvas */}
      <div className="canvas" onDrop={onDrop} onDragOver={onDragOver}>
        {showWelcome && <div className="welcome-text">Drag and drop to create your own code</div>}
        <ReactFlow
          nodes={nodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              label: (
                <div className="node-label">
                  {node.data.label}
                  {node.data.type === "sensor" && (
                    <div style={{ marginTop: "4px" }}>
                      <input
                        type="number"
                        value={node.data.value}
                        min={0}
                        max={1000}
                        step={1}
                        onChange={(e) => updateSensorValue(node.id, +e.target.value)}
                        style={{ width: "60px" }}
                      />
                      <select
                        onChange={(e) => updateCondition(node.id, "operator", e.target.value)}
                      >
                        <option value="">Operator</option>
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value="==">==</option>
                      </select>
                      <select onChange={(e) => updateCondition(node.id, "action", e.target.value)}>
                        <option value="">Action</option>
                        <option value="ON">ON</option>
                        <option value="OFF">OFF</option>
                      </select>
                    </div>
                  )}
                  <button className="delete-node-btn" onClick={() => deleteNode(node.id)}>
                    ✕
                  </button>
                  <Handle type="source" position={Position.Bottom} />
                </div>
              ),
            },
          }))}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={(selection) => setSelectedEdges(selection.edges || [])}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          fitView
        >
          <Controls />
          <Background />
        </ReactFlow>
      </div>

      <button className="export-button" onClick={exportJSON}>
        Export JSON
      </button>
    </div>
  );
}

export default App;
