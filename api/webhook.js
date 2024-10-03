
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const commitData = req.body;

    // Validate if this is a push event, if not, exit
    if (!commitData.ref || !commitData.commits) {
      return res.status(400).json({ error: 'Not a valid push event' });
    }

    // Extract the necessary commit information
    const commits = commitData.commits.map(commit => ({
      message: commit.message,
      author: commit.author.name,
      email: commit.author.email || 'No email provided', // Get author email if available
      url: commit.url,
      timestamp: commit.timestamp,
      repository: commitData.repository.name, // Get the repository name
    }));

    // Send the commits to Monday.com
    try {
      const mondayResult = await sendCommitsToMonday(commits);
      res.status(200).json({ success: true, data: mondayResult });
    } catch (error) {
      console.error('Error sending data to Monday.com:', error);
      res.status(500).json({ error: 'Failed to send data to Monday.com' });
    }
  } else {
    res.status(405).json({ message: 'Only POST requests are accepted' });
  }
}

// Function to send commits data to Monday.com
async function sendCommitsToMonday(commits) {
  const mondayApiUrl = 'https://api.monday.com/v2';
  const mondayApiKey = process.env.MONDAY_API_TOKEN;
  const boardId = process.env.MONDAY_BOARD_ID;

  const results = [];

  // Loop through each commit and send it as an item to the Monday.com board
  for (const commit of commits) {
    // Format timestamp to only include date (e.g., 2023-10-03)
    const formattedTimestamp = commit.timestamp.split('T')[0];

    // Log the commit data for debugging
    console.log('Sending commit:', commit);

    // GraphQL mutation query to create an item on the Monday.com board
    const query = `
      mutation {
        create_item (
          board_id: ${boardId},
          item_name: "${commit.message}",
          column_values: "{\\"text4__1\\": \\"${commit.author}\\", \\"email36__1\\": \\"${commit.email}\\", \\"text__1\\": \\"${commit.url}\\", \\"date__1\\": \\"${formattedTimestamp}\\", \\"text8__1\\": \\"${commit.repository}\\"}"
        ) {
          id
        }
      }
    `;

    // Log the query before sending it
    console.log('Sending query:', query);

    // Send the request to the Monday.com API
    const response = await fetch(mondayApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mondayApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    // Handle the API response
    const result = await response.json();

    // Log the result from Monday.com API
    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
    } else {
      console.log('Success:', result.data);
    }

    results.push(result);
  }

  return results;
}
