describe('Smoke - App loads', () => {
  it('shows login screen core elements', () => {
    cy.visit('/');
    cy.findByTestId('login-email').type('alice@example.com');
    cy.findByTestId('login-password').type('mypassword');
    cy.findByTestId('login-submit').click();
    cy.findByTestId('login-error').should('not.exist');

  });
});
