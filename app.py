import os
import click
from datetime import timedelta
from flask import Flask, render_template
from dotenv import load_dotenv
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask.cli import with_appcontext

from models import db, bcrypt, User

# --- Flask App Initialization ---
load_dotenv()
app = Flask(__name__)

# --- Configuration ---
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=3)

project_root = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(project_root, 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 1GB upload limit

# --- Extensions Initialization ---
db.init_app(app)
bcrypt.init_app(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)
CORS(app)

# --- Root Route ---
@app.route('/')
def index():
    # This might be used for serving the initial React app in production,
    # but during development, Flask and Vite dev server run separately.
    return "AI Meeting Assistant Backend is running."

# --- CLI Commands ---
@app.cli.command("create_admin")
@click.argument("username")
@click.argument("password")
@with_appcontext
def create_admin(username, password):
    """Creates a new admin user."""
    try:
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            print(f"Error: User '{username}' already exists.")
            return

        admin_user = User(username=username, role='admin')
        admin_user.set_password(password)
        db.session.add(admin_user)
        db.session.commit()
        print(f"Admin user '{username}' created successfully.")
    except Exception as e:
        db.session.rollback()
        print(f"An error occurred: {e}")

# --- Import API Routes to register them ---
with app.app_context():
    import api_routes

# --- Main Application Entry Point ---
if __name__ == '__main__':
    port = int(os.environ.get("FLASK_RUN_PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)


# === register new blueprints (AI sync + action items) ===
from ai_routes import ai_bp
from action_item_routes import action_bp
try: app.register_blueprint(ai_bp)
except Exception as e: print("ai_routes not registered:", e)
try: app.register_blueprint(action_bp)
except Exception as e: print("action_item_routes not registered:", e)
