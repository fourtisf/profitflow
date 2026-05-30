export function Nav() {
  return (
    <nav>
      <div className="wrap nav-in">
        <div className="logo">
          <span className="dot" /> ProfitFlow
        </div>
        <div className="nlinks">
          <a href="#angle">Why</a>
          <a href="#proof">Proof</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#share">Share</a>
        </div>
        <a href="#waitlist" className="btn btn-w">
          Launch App
        </a>
      </div>
    </nav>
  );
}
