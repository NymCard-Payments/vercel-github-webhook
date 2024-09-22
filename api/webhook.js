// api/webhook.js

export default async function handler(req, res) {
    if (req.method === 'POST') {
      const { head_commit, repository } = req.body;
  
      // Extract commit information
      const commitMessage = head_commit.message;
      const commitDate = head_commit.timestamp;
      const developerName = head_commit.author.name;
      const repoName = repository.name;
  
      // Now, send the commit data to monday.com via their API
      const response = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQxMzc0NDI4MSwiYWFpIjoxMSwidWlkIjo2MDkzMDEyMywiaWFkIjoiMjAyNC0wOS0yMVQwODo1NToyNC41MTFaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6ODcxMjM4MSwicmduIjoidXNlMSJ9.vj6OKWxJIfimGj983JcXX3Ow1l2ttcrZ1tZ92RxQDJs', // Replace with your monday.com API token
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `
            mutation {
              create_item (board_id: 7452641398, item_name: "${developerName}", column_values: "{\"commit_message\": \"${commitMessage}\", \"commit_date\": \"${commitDate}\", \"repository\": \"${repoName}\"}") {
                id
              }
            }
          `
        })
      });
  
      if (response.ok) {
        res.status(200).json({ message: 'Commit data sent to monday.com' });
      } else {
        res.status(500).json({ message: 'Error sending data to monday.com' });
      }
    } else {
      res.status(405).json({ message: 'Only POST requests are allowed' });
    }
  }
  