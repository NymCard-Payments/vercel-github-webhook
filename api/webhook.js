export default async function handler(req, res) {
    if (req.method === 'POST') {  // Check if the request is a POST method, which is what GitHub sends
      const { head_commit, repository } = req.body;  // Destructure the webhook payload
  
      // Extract commit information from the GitHub webhook payload
      const commitMessage = head_commit.message;   // Get the commit message
      const commitDate = head_commit.timestamp;    // Get the commit date
      const developerName = head_commit.author.name;  // Get the developer's name
      const repoName = repository.name;  // Get the name of the repository where the commit was made
  
      // Now, send the extracted commit data to monday.com using their API
      const response = await fetch('https://api.monday.com/v2', {
        method: 'POST',  // The monday.com API requires POST requests
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQxMzc0NDI4MSwiYWFpIjoxMSwidWlkIjo2MDkzMDEyMywiaWFkIjoiMjAyNC0wOS0yMVQwODo1NToyNC41MTFaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6ODcxMjM4MSwicmduIjoidXNlMSJ9.vj6OKWxJIfimGj983JcXX3Ow1l2ttcrZ1tZ92RxQDJs',  // Replace with your real monday.com API token
          'Content-Type': 'application/json',  // Set content-type to JSON
        },
        body: JSON.stringify({  // Prepare the GraphQL mutation query to send the data to monday.com
          query: `
            mutation {
              create_item (
                board_id: 7452641398,  // Replace YOUR_BOARD_ID with your actual monday.com board ID
                item_name: "${developerName}",  // The developer's name will be the item name in the monday.com board
                column_values: "{\"text4__1\": \"${developerName}\", \"text__1\": \"${commitMessage}\", \"date4\": \"${commitDate}\", \"text8__1\": \"${repoName}\"}"
              ) {
                id
              }
            }
          `,
        }),
      });
  
      // Check the response from monday.com and handle success or failure
      if (response.ok) {
        res.status(200).json({ message: 'Commit data sent to monday.com' });
      } else {
        res.status(500).json({ message: 'Error sending data to monday.com' });
      }
    } else {
      res.status(405).json({ message: 'Only POST requests are allowed' });
    }
  }
  
