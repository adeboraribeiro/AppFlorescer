type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
};

export class BromeliaService {
    private messages: Message[];
    private readonly serverUrl: string;

    constructor() {
        // Always use the production URL since we're deployed
        this.serverUrl = 'https://bromelia-server.onrender.com';
        // Service is a thin bridge; do not duplicate server-side prompts here
        this.messages = [];
    }

    async sendMessage(message: string, onChunk: (chunk: string) => void): Promise<void> {
        if (!message?.trim()) {
            return;
        }

        try {
            // Add user message
            const userMessage: Message = { role: 'user', content: message };
            this.messages.push(userMessage);

            console.log('Sending request to:', this.serverUrl);
            console.log('Message:', message);
            
            // Send request to Python server
            const response = await fetch(`${this.serverUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
                // Add React Native specific options
                credentials: 'omit',  // Don't send cookies
                mode: 'cors',        // Explicitly request CORS mode
            });
            
            console.log('Response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const data = await response.json();
            if (!data.response) {
                throw new Error('Empty response from server');
            }

            // Send response
            onChunk(data.response);

            // Add assistant message to history
            const assistantMessage: Message = { role: 'assistant', content: data.response };
            this.messages.push(assistantMessage);

        } catch (error) {
            console.error('Bromélia error:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content: 'Ops, tive um probleminha técnico. Pode tentar falar de novo? :)'
            };
            onChunk(errorMessage.content);
            this.messages.push(errorMessage);
        }
    }

    /**
     * Reset the conversation state stored locally and return the assistant's initial greeting text
     * (the UI handles displaying the greeting). Do not inject system prompts here; server is authoritative.
     */
    resetConversation(): string {
        // clear local history; server provides system/assistant prompts
        this.messages = [];
        const assistantGreeting = "Oi! Eu sou Bromélia, uma amiga plantinha falante :)! Estou aqui para bater papo e conhecer você melhor. Como você está hoje? Quer falar sobre seu dia ou alguma coisa que esteja em sua mente?";
        return assistantGreeting;
    }
}

export const bromeliaService = new BromeliaService();
export default bromeliaService;
