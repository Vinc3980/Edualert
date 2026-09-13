import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <h1>Something went wrong.</h1>
          <p>{this.state.error?.message || "An unexpected error occurred."}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: "8px 20px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}