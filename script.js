/*
 * This script handles form submissions for the contact page. It posts form
 * data to a Google Apps Script endpoint that writes the submission to a
 * Google Sheet.  To set this up:
 *  1. Follow the instructions in the GitHub project "form-to-google-sheets"
 *     to create a Google Sheet, Apps Script and deployment URL【419235211640588†L9-L31】.
 *  2. Replace the placeholder below (YOUR_SCRIPT_URL_HERE) with your
 *     deployed web app URL from step 5 of the instructions【419235211640588†L97-L106】.
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form[name="contact-form"]');
  if (!form) return;

  const status = document.getElementById('form-status');
  // Replace with your actual Apps Script URL once you deploy your script.
  const scriptURL = 'YOUR_SCRIPT_URL_HERE';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    status.textContent = 'Sending…';

    const formData = new FormData(form);
    fetch(scriptURL, {
      method: 'POST',
      body: formData
    })
    .then(response => {
      status.textContent = 'Thank you! Your message has been sent.';
      form.reset();
    })
    .catch(error => {
      console.error('Error!', error.message);
      status.textContent = 'Sorry, there was a problem sending your message.';
    });
  });
});