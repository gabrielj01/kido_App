// cypress/support/commands.js
import '@testing-library/cypress/add-commands';

// --- Generic helpers ---------------------------------------------------------

// Type into an input by [data-testid] when available, otherwise by placeholder text.
Cypress.Commands.add('typeByIdOrPlaceholder', (testId, placeholderRegex, text) => {
  cy.get('body').then($body => {
    const sel = `[data-testid="${testId}"]`;
    if ($body.find(sel).length) {
      cy.findByTestId(testId).clear().type(text);
    } else {
      cy.findByPlaceholderText(placeholderRegex).clear().type(text);
    }
  });
});

// Click an element by [data-testid] when available, otherwise by visible text.
Cypress.Commands.add('clickByIdOrText', (testId, textRegex) => {
  cy.get('body').then($body => {
    const sel = `[data-testid="${testId}"]`;
    if ($body.find(sel).length) {
      cy.findByTestId(testId).should('be.visible').click();
    } else {
      cy.findAllByText(textRegex, { exact: false })
        .filter(':visible')
        .first()
        .click();
    }
  });
});

// Assert that an element (by testId or fallback text) contains the expected text.
Cypress.Commands.add('shouldContainTextByIdOr', (testId, textRegex, expected) => {
  cy.get('body').then($body => {
    const sel = `[data-testid="${testId}"]`;
    if ($body.find(sel).length) {
      cy.findByTestId(testId).should('contain.text', expected);
    } else {
      cy.findAllByText(textRegex, { exact: false })
        .filter(':visible')
        .first()
        .should('contain.text', expected);
    }
  });
});

// --- High-level helper: UI login (stubs backend) -----------------------------

Cypress.Commands.add('uiLoginAs', (role = 'parent') => {
  // 1) Visit login screen
  cy.visit('/');

  // 2) Wait for login screen to render (robust)
  cy.contains(/welcome back|log in to find trusted/i, { timeout: 15000 }).should('be.visible');

  // Derive credentials + display name by role
  const emailValue = role === 'sitter' ? 'noa@example.com' : 'alice@example.com';
  const nameValue  = role === 'sitter' ? 'Noa'           : 'Alice';
  const idValue    = role === 'sitter' ? 'sitter_noa'    : 'parent_alice';

  // 3) Stub the POST /api/auth/login before clicking submit
  cy.intercept('POST', '**/api/auth/login', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        token: 'fake-jwt-token',
        user: {
          _id: idValue,
          role,
          name: nameValue,
          email: emailValue,
        },
      },
    });
  }).as('loginReq');

  // 3bis) Short-circuit /api/users/me to keep UI consistent and avoid 401s
  cy.intercept('GET', '**/api/users/me', {
    statusCode: 200,
    body: {
      _id: idValue,
      id: idValue,
      name: nameValue,
      email: emailValue,
      role,
    },
  }).as('me');

  // 4) Fill credentials using resilient selectors
  cy.typeByIdOrPlaceholder('login-email', /you@|email/i, emailValue);
  cy.typeByIdOrPlaceholder('login-password', /password|•/i, 'mypassword');

  // 5) Submit
  cy.clickByIdOrText('login-submit', /log in/i);

  // 6) Wait for stubbed response (cast to number for safety)
  cy.wait('@loginReq')
    .its('response.statusCode')
    .then(code => expect(Number(code)).to.be.oneOf([200, 201]));

  // 7) Optional: ensure we've landed on a visible root tab (stabilizes next steps)
  cy.findAllByText(/search|home|requests|bookings/i, { exact: false })
    .filter(':visible')
    .first()
    .should('be.visible');
});
