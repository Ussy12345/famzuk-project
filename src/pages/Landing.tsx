import { Link } from 'react-router-dom'
const steps = ['Tell us your course, level and topic', 'Answer a few questions from the AI interviewer', 'Choose how detailed the project should be', 'Review, edit and export to PDF or DOCX']
const feats = ['Course-aware structure and questions', 'Project memory you can read and correct', 'Section-by-section generation that saves as it goes', 'Sources are never invented — you add and verify them']
export default function Landing() {
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between p-5"><b className="font-display text-xl">Famzuk Projects</b><Link to="/login" className="btn-ghost">Sign in</Link></header>
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-28">
        <h1 className="font-display max-w-3xl text-4xl font-bold leading-tight md:text-6xl">Build your university project with AI.</h1>
        <p className="mt-6 max-w-xl text-lg text-ink/70">Develop and organise your final-year project from topic to structured document. You provide the facts; Famzuk Projects helps you shape and write them in simple English.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link to="/register" className="btn-gold">Start your project</Link><Link to="/login" className="btn-ghost">Sign in</Link></div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-2">
        <div><h2 className="font-display text-2xl font-semibold">How it works</h2><ol className="mt-4 list-decimal space-y-3 pl-5">{steps.map(x => <li key={x}>{x}</li>)}</ol></div>
        <div><h2 className="font-display text-2xl font-semibold">Features</h2><ul className="mt-4 list-disc space-y-3 pl-5">{feats.map(x => <li key={x}>{x}</li>)}</ul></div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-8"><h2 className="font-display text-2xl font-semibold">Supported courses</h2><p className="mt-3 text-ink/70">Computer Science, Accounting, Biochemistry, Economics, Mass Communication, Business Administration, Microbiology, Education and more being added.</p></section>
      <section className="mx-auto max-w-6xl px-5 py-8"><h2 className="font-display text-2xl font-semibold">FAQ</h2>
        <p className="mt-3"><b>Will it invent references?</b> No. Sources come from you and are labelled by how they were verified.</p>
        <p className="mt-2"><b>Will it make up my results?</b> No. Where real data is needed it leaves a clear placeholder.</p></section>
      <footer className="mt-12 border-t border-ink/10 p-6 text-center text-sm text-ink/60">© Famzuk Projects</footer>
    </div>)
}
