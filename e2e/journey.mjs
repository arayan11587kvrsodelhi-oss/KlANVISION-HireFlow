// End-to-end journey against the live Vite app + FastAPI backend.
// Run: node <browser-automation>/browser.mjs http://127.0.0.1:3000/ --script ./e2e/journey.mjs
export default async function run(page, ui) {
  const log = [];
  const stamp = Date.now().toString(36);
  const candidateEmail = `ui-cand-${stamp}@example.com`;
  const recruiterEmail = `ui-rec-${stamp}@example.com`;
  const password = 'Password123';

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  const serverErrors = [];
  page.on('response', (res) => {
    if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`);
  });

  const signOut = async () => {
    await page.evaluate(async () => {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    });
  };

  const signIn = async (email) => {
    await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle' });
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(password);
    await page.getByRole('button', { name: /^Sign In/ }).click();
    await page.waitForTimeout(2500);
  };

  // 1. Landing page is real, not a mock-data shell.
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  const landing = await page.evaluate(() => document.body.innerText);
  log.push({
    step: 'landing',
    renders: landing.includes('HireFlow'),
    noSampleBanner: !/SAMPLE ENVIRONMENT/i.test(landing),
    chars: landing.length,
  });

  // 2. Recruiter registers; registration must NOT log them in.
  await page.goto('http://127.0.0.1:3000/register?role=recruiter', { waitUntil: 'networkidle' });
  await page.locator('input[type=text]').first().fill('UI Recruiter');
  await page.locator('input[type=email]').fill(recruiterEmail);
  await page.locator('input[type=password]').fill(password);
  const companyInput = page.locator('input[type=text]').nth(1);
  await companyInput.fill('UI Test Company');
  await page.getByRole('button', { name: /Create Recruiter Account/i }).click();
  await page.waitForTimeout(2500);
  log.push({ step: 'recruiter-register', path: new URL(page.url()).pathname, onLogin: page.url().includes('/login') });

  // 3. Recruiter signs in and lands on the employer workspace.
  await signIn(recruiterEmail);
  const recruiterHome = await page.evaluate(() => document.body.innerText);
  log.push({
    step: 'recruiter-login',
    path: new URL(page.url()).pathname,
    showsOwnCompany: recruiterHome.includes('UI Test Company'),
    leakedDefaultCompany: recruiterHome.includes('CloudScale'),
  });

  // 4. Recruiter publishes a job through the form.
  await page.goto('http://127.0.0.1:3000/recruiter/jobs/new', { waitUntil: 'networkidle' });
  await page.locator('input').first().fill(`UI Engineer ${stamp}`);
  await page.locator('textarea').first().fill('An end-to-end requisition created through the real UI form.');
  await page.getByRole('button', { name: /Publish Job Posting/i }).click();
  await page.waitForTimeout(3000);
  const jobsPage = await page.evaluate(() => document.body.innerText);
  log.push({ step: 'publish-job', path: new URL(page.url()).pathname, created: jobsPage.includes(`UI Engineer ${stamp}`) });

  // 5. Candidate registers and signs in.
  await signOut();
  await page.goto('http://127.0.0.1:3000/register', { waitUntil: 'networkidle' });
  await page.locator('input[type=text]').first().fill('UI Candidate');
  await page.locator('input[type=email]').fill(candidateEmail);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: /Create Candidate Account/i }).click();
  await page.waitForTimeout(2500);
  await signIn(candidateEmail);
  log.push({ step: 'candidate-login', path: new URL(page.url()).pathname });

  // 6. Role guard: a candidate cannot open the recruiter workspace.
  await page.goto('http://127.0.0.1:3000/recruiter/jobs', { waitUntil: 'networkidle' });
  const guard = await page.evaluate(() => document.body.innerText);
  log.push({
    step: 'role-guard',
    blocked: /access restricted/i.test(guard),
    leakedJobTable: guard.includes('Job Requisitions'),
  });

  // 7. Resume upload through the real file input.
  await page.goto('http://127.0.0.1:3000/candidate/resume', { waitUntil: 'networkidle' });
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n');
  await page.locator('#resume-file-input').setInputFiles({
    name: 'ui-resume.pdf',
    mimeType: 'application/pdf',
    buffer: pdf,
  });
  await page.waitForTimeout(3000);
  const resumePage = await page.evaluate(() => document.body.innerText);
  log.push({
    step: 'resume-upload',
    uploaded: resumePage.includes('ui-resume.pdf'),
    uploadError: resumePage.match(/Unsupported[^\n]*|exceeds[^\n]*/)?.[0] ?? null,
  });

  // 8. Candidate finds the job on the board and applies.
  await page.goto('http://127.0.0.1:3000/jobs', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const jobTitle = `UI Engineer ${stamp}`;
  const jobVisible = (await page.evaluate(() => document.body.innerText)).includes(jobTitle);
  log.push({ step: 'job-board', jobVisible });

  if (jobVisible) {
    await page.getByText(jobTitle).first().click();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /Apply for Position/i }).click();
    await page.waitForTimeout(700);
    const letter = page.locator('textarea');
    if (await letter.count()) await letter.last().fill('I would like to join the UI test company.');
    await page.getByRole('button', { name: /Confirm & Submit Application/i }).click();
    await page.waitForTimeout(3000);
    const modal = await page.evaluate(() => document.body.innerText);
    log.push({
      step: 'apply',
      success: modal.includes('Application Recorded'),
      buttonNowSent: modal.includes('Application Sent'),
      error: modal.match(/Upload a resume[^\n]*|Failed to submit[^\n]*/)?.[0] ?? null,
    });
  }

  // 9. Candidate application tracker shows it.
  await page.goto('http://127.0.0.1:3000/candidate/applications', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const tracker = await page.evaluate(() => document.body.innerText);
  log.push({
    step: 'tracker',
    showsApplication: tracker.includes(jobTitle),
    emptyState: tracker.includes('No applications in this category'),
  });
  await page.screenshot({ path: 'e2e/candidate-applications.png', fullPage: true });

  // 10. Recruiter sees the applicant and advances the stage.
  await signOut();
  await signIn(recruiterEmail);
  await page.goto('http://127.0.0.1:3000/recruiter/applicants', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const pipeline = await page.evaluate(() => document.body.innerText);
  log.push({
    step: 'pipeline',
    showsApplicant: pipeline.includes('UI Candidate'),
    showsEmail: pipeline.includes(candidateEmail),
  });
  await page.screenshot({ path: 'e2e/recruiter-pipeline.png', fullPage: true });

  if (pipeline.includes('UI Candidate')) {
    await page.getByText('UI Candidate').first().click();
    await page.waitForTimeout(800);
    await page.locator('select').last().selectOption('Shortlisted');
    await page.getByRole('button', { name: /Save Status & Feedback/i }).click();
    await page.waitForTimeout(2500);
    const afterSave = await page.evaluate(() => document.body.innerText);
    log.push({
      step: 'stage-update',
      saved: afterSave.includes('Status updated successfully'),
      error: afterSave.match(/Failed[^\n]*|Cannot move[^\n]*/)?.[0] ?? null,
    });
  }

  // 11. The candidate sees the new stage and the recruiter's note.
  await signOut();
  await signIn(candidateEmail);
  await page.goto('http://127.0.0.1:3000/candidate/applications', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const finalText = await page.evaluate(() => document.body.innerText);
  log.push({ step: 'stage-visible-to-candidate', shortlisted: finalText.includes('Shortlisted') });

  await page.screenshot({ path: 'e2e/candidate-final.png', fullPage: true });

  return { log, consoleErrors: consoleErrors.slice(0, 8), serverErrors: serverErrors.slice(0, 8) };
}
