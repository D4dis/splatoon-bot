pipeline {
  agent {
    label 'Test'
  }
  stages {
        stage('Verifier et installer apache2') {
      steps {
        sh '''
                    if [ ! -f /usr/sbin/apache2 ]; then
                        echo "Apache2 non installé - Installation..."
                        sudo apt-get update
                        sudo apt-get install -y apache2
                    else
                        echo "Apache2 est déjà installé"
                    fi
                '''
      }
        }

        stage('checkout') {
      steps {
        checkout scm
      }
        }

        stage('Copier index.html') {
      steps {
        sh 'sudo cp index.html /var/www/html/index.html'
      }
        }

        stage('Redémarrer Apache2') {
      steps {
        sh 'sudo systemctl restart apache2'
      }
        }

        stage('Test du serveur') {
      steps {
        sh 'curl http://localhost'
      }
        }
  }

    post {
        success {
      echo 'Déploiement HTML effectué et Apache redémarré.'
        }
        failure {
      echo 'Une erreur est survenue pendant le déploiement.'
        }
        always {
          cleanWs()
        }
    }
}
