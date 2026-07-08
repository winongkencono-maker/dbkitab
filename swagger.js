const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kitab E-Book REST API',
      version: '1.0.0',
      description: 'API lengkap untuk aplikasi buku digital Islam (Semantic Search, Filter, Authors, dll)',
    },
    servers: [
      {
        url: 'https://ebook.sarungtambalan.my.id',
        description: 'Production Server (Cloudflare Tunnel)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      }
    }
  },
  // Paths to files containing OpenAPI definitions
  apis: ['./routes/*.js', './routes/**/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log('Swagger UI available at http://localhost:8081/api-docs');
}

module.exports = setupSwagger;
