import { Link } from "react-router-dom";
import Brand from "../components/Brand";

export default function Landing() {
  return <div className="landing">
    <header className="public-nav page-width"><Brand /><Link className="text-link" to="/login">Sign in <span aria-hidden="true">↗</span></Link></header>
    <div>
      <section className="market-hero page-width">
        <div className="hero-copy">
          <p className="intro-note">For the people you share a kitchen with.</p>
          <h1>A little planning.<br />A fresher week.</h1>
          <p className="hero-description">One shared place for the groceries you need and the food you have. Make a list, bring everyone along, and use the good stuff before it goes.</p>
          <Link className="btn btn-primary hero-cta" to="/login?mode=register">Make your first list <span aria-hidden="true">↗</span></Link>
          <a className="hero-secondary" href="#how-it-works">Take a look inside <span aria-hidden="true">↓</span></a>
          <div className="hero-footnote"><i className="bi bi-people" aria-hidden="true" /> Roommates, families, whoever’s cooking.</div>
        </div>
        <div className="hero-scene">
          <img className="market-photo" src="/images/market.jpg" alt="Fresh vegetables arranged at a neighborhood grocery market" width="1200" height="900" fetchPriority="high" />
          <div className="sample-list" aria-label="Example grocery list">
            <div className="sample-top"><span>THE WEEKLY SHOP</span><i className="bi bi-basket2" aria-hidden="true" /></div>
            <h2>A few good things.</h2>
            <div className="sample-row"><span>Cherry tomatoes</span><span>2 boxes</span></div>
            <div className="sample-row"><span>Fresh spinach</span><span>1 bag</span></div>
            <div className="sample-row"><span>Sourdough</span><span>1 loaf</span></div>
            <div className="sample-bottom"><span><i className="bi bi-people" aria-hidden="true" /> Shared with your household</span><span>Example list</span></div>
          </div>
          <p className="scene-caption">Less “did we need milk?” More dinner together.</p>
        </div>
      </section>
      <section className="how-section page-width" id="how-it-works">
        <div className="how-heading"><h2>From the shopping aisle<br />to your kitchen table.</h2><p>A few useful tools.<br />A little less to keep in your head.</p></div>
        <div className="feature-story"><div><h3>A list for every kind of shop.</h3><p>The weekly restock. Saturday’s dinner. That big pantry run. Keep them separate, find what you need, and adjust quantities as plans change.</p></div><div className="feature-detail"><span>Weekly groceries</span><span>Saturday dinner</span><span>Pantry staples</span></div></div>
        <div className="feature-story"><div><h3>Same kitchen. Same page.</h3><p>Share a list by email. Let someone help edit, or give them a view of what’s needed. Everyone has a place in the plan.</p></div><div className="sharing-example"><i className="bi bi-people" aria-hidden="true" /><span>You choose who can<br /><strong>view or edit your list.</strong></span></div></div>
        <div className="feature-story"><div><h3>Keep an eye on the fresh stuff.</h3><p>Add expiry dates and sort by what needs using first. A small reminder to turn that spinach into something good.</p></div><div className="expiry-example"><span>Fresh spinach</span><span className="expiry-label">Use soon · in 2 days</span><small>Example expiry reminder</small></div></div>
      </section>
      <section className="closing-note page-width"><h2>Good meals start<br />with a little list.</h2><Link className="btn btn-primary" to="/login?mode=register">Start your list <span aria-hidden="true">↗</span></Link></section>
    </div>
    <footer className="site-footer page-width"><div><Brand /><p>A little more order in the everyday.</p></div><Link to="/terms">Terms of Service</Link><span>Made for shared kitchens.</span></footer>
  </div>;
}
