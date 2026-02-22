import "./App.css";

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>EatTracker</h1>
          <p>Plan meals around the food you already have.</p>
        </div>
      </header>

      <main className="app__main">
        <section className="card">
          <h2>Goals</h2>
          <p>Set daily macro ranges to guide recommendations.</p>
        </section>

        <section className="card">
          <h2>Pantry</h2>
          <p>Add foods with nutrition per unit and how many you have on hand.</p>
        </section>

        <section className="card">
          <h2>Planner</h2>
          <p>Generate meal suggestions that match your goals and pantry constraints.</p>
        </section>
      </main>
    </div>
  );
}
