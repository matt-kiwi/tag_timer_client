import socket
# https://www.datacamp.com/tutorial/a-complete-guide-to-socket-programming-in-python

def run_client():
    # create a socket object
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    server_ip = "192.168.1.50"  # replace with the server's IP address
    server_port = 7000  # replace with the server's port number
    # establish connection with server
    client.connect((server_ip, server_port))

    while True:
        # input message and send it to the server
        # msg = input("Enter message: ")
        # client.send(msg.encode("utf-8")[:1024])

        # receive message from the server
        response = client.recv(1024)
        response = response.decode("utf-8")

        # if server sent us "closed" in the payload, we break out of the loop and close our socket
        if response.lower() == "closed":
            break

        print(f"Received: {response}")

    # close client socket (connection to the server)
    client.close()
    print("Connection to server closed")

# We don't come back from this it's a tight loop.
# Keep looping through in case of Ethernet disconnect.
run_client()

Received: TN    4    4 M1 18:01:33.15300  8829

Received: TN    4    4 M4 18:01:38.10100  8829
RR    2    4           4.94800
VE 1    4 292.472 km/h
