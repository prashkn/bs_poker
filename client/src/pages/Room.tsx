import { useParams } from "react-router-dom";

export default function Room() {
  const { id } = useParams<{ id: string }>();

  return (
    <div style={{ padding: 24, color: "#fff" }}>
      <h1>Room {id}</h1>
      <p>Game lobby coming soon.</p>
    </div>
  );
}
