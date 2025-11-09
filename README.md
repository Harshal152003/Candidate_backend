A MERN-based candidate interview platform where candidates can fill out a form, record a short video introduction, and review their submission before finalizing.

 Features

Candidate information form (Name, Email, Phone, Resume upload, etc.)

Video recording with 90-second limit, live preview, start/stop controls

Review page to preview candidate details, resume, and video before submission

Edit option to update information before final submission

Success popup message after submission

MongoDB Atlas integration for data storage

 Tech Stack

Frontend: React.js, Bootstrap, Axios

Backend: Node.js, Express.js

Database: MongoDB Atlas

Other Tools: React Router, Multer (for file uploads)

 Setup Instructions
1️ Clone the Repository
git clone https://github.com/your-username/candidate-interview-app.git
cd candidate-interview-app

2️ Install Dependencies

For Frontend:

cd frontend
npm install


For Backend:

cd ../backend
npm install

3️ Configure Environment Variables

Create a .env file inside the backend folder and add:

PORT=3001
MONGODB_URI=your-mongodb-atlas-connection-string

4️ Run the App Locally

Start Backend:

cd backend
npm start


Start Frontend:

cd ../frontend
npm run dev


Frontend runs on http://localhost:5173

Backend runs on http://localhost:3001

5️ Build for Deployment

Create a production build for the frontend:

cd frontend
npm run build


This will generate a production build inside the dist folder.

6️ Deployment

You can deploy:

Frontend using → Vercel, Netlify, or GitHub Pages

Backend using → Render, Railway, or Vercel (Serverless Functions)

 Folder Structure
candidate-interview-app/
│
├── backend/
│   ├── server.js
│   ├── routes/
│   ├── models/
│   ├── controllers/
│   └── .env
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
└── README.md
 

Harshal Ladukar
📧 Email: harshladukar@gmail.com

🌐 Portfolio: https://devwithharshal.site
