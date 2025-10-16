import './commands';
import '@testing-library/cypress/add-commands';

// Avoid random RN/Expo warnings from failing tests
Cypress.on('uncaught:exception', () => false);
