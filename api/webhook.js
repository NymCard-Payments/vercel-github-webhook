export default async function handler(req, res) {
  if (req.method === 'POST') {  
      // Check if the request is a POST method, which is what GitHub sends
      console.log('GitHub Webhook Payload:', req.body);  // Log the entire webhook payload for debugging

      // Safely extract the necessary properties from the webhook payload
      const head_commit = req.body?.head_commit || {};
      const repository = req.body?.repository || {};

      // Extract commit information safely
      const commitMessage = head_commit.message || 'No commit message';   // Get the commit message
      const commitDate = head_commit.timestamp || new Date().toISOString(); // Get the commit date or fallback to current date
      const developerName = head_commit.author?.name || 'Unknown Developer';  // Get the developer's name or set to 'Unknown'
      const repoName = repository.name || 'Unknown Repo';  // Get the name of the repository or set to 'Unknown'

      // Log extracted values for debugging
      console.log('Commit Message:', commitMessage);
      console.log('Commit Date:', commitDate);
      console.log('Developer Name:', developerName);
      console.log('Repository Name:', repoName);

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
                          board_id: 7452641398,  // Replace with your actual monday.com board ID
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
          const errorMessage = await response.text();
          console.error('Error from monday.com:', errorMessage);  // Log the error message for debugging
          res.status(500).json({ message: `Error sending data to monday.com: ${errorMessage}` });
      }
  } else {
      res.status(405).json({ message: 'Only POST requests are allowed' });
  }
}

